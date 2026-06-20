const express = require('express');
const app = express();

// Configuration dynamique du trust proxy (1 par défaut pour Render)
const trustProxyValue = process.env.TRUST_PROXY;

if (trustProxyValue) {
    if (!isNaN(trustProxyValue)) {
        app.set('trust proxy', parseInt(trustProxyValue, 10));
    } else if (trustProxyValue === 'true') {
        app.set('trust proxy', true);
    } else if (trustProxyValue === 'false') {
        app.set('trust proxy', false);
    } else {
        app.set('trust proxy', trustProxyValue);
    }
} else {
    app.set('trust proxy', process.env.NODE_ENV === 'production' ? 3 : false);
}


const path = require("path");
const cookieParser = require("cookie-parser");

const { generalLimiter } = require('./middleware/limMiddleware');
const requestLogger = require('./middleware/requestLogger');

const cors = require('cors');
const helmet = require('helmet');
const { getAllowedOrigins, isOriginAllowed } = require('./config/security');
const logger = require('./utils/logger');


const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({

    // ── HTTP Strict Transport Security (HSTS) ────────────────────────────────
    // Force le navigateur à utiliser HTTPS pour 1 an.
    // Activé uniquement en production (Render fournit HTTPS nativement).
    strictTransportSecurity: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,

    // ── Cross-Origin Resource Policy ─────────────────────────────────────────
    // "cross-origin" : permet au frontend React (domaine différent) de charger
    // les images de QR codes servies par ce backend.
    crossOriginResourcePolicy: { policy: "cross-origin" },

    // ── Cross-Origin Embedder Policy ─────────────────────────────────────────
    // Désactivé : COEP bloquerait les ressources cross-origin (ex: QR codes depuis
    // le frontend) qui n'ont pas de header CORP explicite sur chaque réponse.
    crossOriginEmbedderPolicy: false,

    // ── Clickjacking protection ───────────────────────────────────────────────
    // Interdit l'intégration de ce backend dans des iframes.
    frameguard: { action: "deny" },

    // ── MIME Sniffing protection ──────────────────────────────────────────────
    // Empêche le navigateur de deviner le type MIME d'une réponse.
    noSniff: true,

    // ── Referrer Policy ──────────────────────────────────────────────────────
    // N'envoie l'URL complète en Referer que vers la même origine.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // ── DNS Prefetch Control ──────────────────────────────────────────────────
    // Désactive le prefetch DNS automatique du navigateur.
    dnsPrefetchControl: { allow: false },

    // ── X-Powered-By ─────────────────────────────────────────────────────────
    // Supprime le header "X-Powered-By: Express" pour ne pas exposer la stack.
    hidePoweredBy: true,

    // ── Cross-Domain Policy (Flash / PDF readers) ─────────────────────────────
    // Interdit le chargement de fichiers de politique cross-domaine.
    permittedCrossDomainPolicies: { permittedPolicies: "none" },

}));


// ===== Configurer CORS pour React =====
const allowedOrigins = getAllowedOrigins();

app.use(cors({
    origin: function (origin, callback) {
        if (!isOriginAllowed(origin, allowedOrigins)) {
            var msg = 'La politique CORS de ce site n\'autorise pas l\'accès depuis cette origine.';
            logger.warn("cors.denied", { origin });
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// ===== Middlewares globaux =====
app.use(generalLimiter); // Filet de sécurité global contre les abus et DDoS basiques
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des cookies sécurisée si en HTTPS
app.use(cookieParser(process.env.JWT_SECRET));
app.use(requestLogger);



// ===== Fichiers statiques =====
app.use(express.static(path.join(__dirname, "statics")));

// Importer les différentes routes depuis le dossier src/routes/
const userRoutes = require("./routes/user.routes");
const eventRoutes = require("./routes/event.routes");
const qrRoutes = require("./routes/qr.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const areaRoutes = require("./routes/area.routes");
const agentRoutes = require("./routes/agent.routes");
const exportRoutes = require("./routes/export.routes");

// ===== Utilisation des routes =====
// On préfixe toutes les routes utilisateurs par /user (/user/login, /user/signup, etc.)
app.use("/user", userRoutes);

// On préfixe toutes les autres routes (événements, qrcodes...) par leur nom logique
app.use("/events", eventRoutes);
app.use("/qr", qrRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/areas", areaRoutes);
app.use("/agents", agentRoutes);
app.use("/export", exportRoutes);

app.use((err, req, res, next) => {
    logger.error("request.unhandled_error", {
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        error: err
    });

    if (res.headersSent) return next(err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
});

module.exports = app;
