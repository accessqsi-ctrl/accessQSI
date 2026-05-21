const express = require('express');
const app = express();

// Render utilise un reverse proxy → nécessaire pour express-rate-limit et les IPs clients
app.set('trust proxy', 1);
const path = require("path");
const cookieParser = require("cookie-parser");

const cors = require('cors');
const helmet = require('helmet');


app.use(helmet({
    crossOriginResourcePolicy: false, // Permet le chargement d'images de QR codes depuis le frontend
    contentSecurityPolicy: false // Pour le dev local, sinon à configurer finement en prod
}));

// ===== Configurer CORS pour React =====
const allowedOrigins = [
    process.env.FRONTEND_URL
].filter(Boolean);

console.log(allowedOrigins);
console.log(process.env.FRONTEND_URL);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// ===== Middlewares globaux =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des cookies sécurisée si en HTTPS
app.use(cookieParser(process.env.JWT_SECRET));





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


module.exports = app;