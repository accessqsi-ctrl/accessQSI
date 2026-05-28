const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
const eventService = require('../services/event.service');
const qrService = require('../services/qr.service');

// Générer un QR Code
exports.generateQrForEvent = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);
        const { fullName, email, phone, accessType, limit, validFrom, validUntil, level } = req.body;

        if (!fullName || !accessType) {
            return res.status(400).json({ success: false, message: "Nom complet et Type d'accès requis" });
        }

        // Vérifier que l'événement appartient à l'organisation de l'utilisateur
        const event = await eventService.findById(orgId, eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Événement non trouvé ou accès refusé' });
        }

        // Générer un jeton sécurisé par cryptographie
        const uniqueToken = crypto.randomUUID();

        // Définir les limites selon le type d'accès
        let usageLimit = 1;
        if (accessType === 'multi') usageLimit = Number(limit) || 2;
        if (accessType === 'unlimited') usageLimit = 999999;

        // Enregistrer la configuration du QR Code dans Prisma
        const qrRecord = await qrService.createQr({
            unique_token: uniqueToken,
            status: "active",
            usage_limit: usageLimit,
            valid_from: validFrom ? new Date(validFrom) : null,
            valid_until: validUntil ? new Date(validUntil) : null,
            level: level ? Number(level) : 1,
            holder_name: fullName,
            holder_email: email || null,
            holder_phone: phone || null,
            event_id: event.event_id
        });

        // Les données sécurisées placées dans l'image physique du QR
        const qrData = JSON.stringify({
            t: uniqueToken,      // Le jeton sécurisé représentant ce pass
            e: event.event_id          // L'événement ciblé
        });

        const qrFilename = `qr_${holder_email}_${uniqueToken}.png`;
        const qrPath = path.join(__dirname, '../statics/qrcodes', qrFilename);

        // S'assurer que le répertoire existe
        const dir = path.dirname(qrPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Générer physiquement le PNG
        await QRCode.toFile(qrPath, qrData, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 400
        });

        const qrUrl = `/qrcodes/${qrFilename}`;

        return res.status(201).json({
            success: true,
            message: 'QR Code généré et sauvegardé avec succès',
            qrUrl: qrUrl,
            qrCode: qrRecord,
            event: { id: event.event_id, title: event.title }
        });

    } catch (error) {
        console.error('Erreur lors de la génération du QR:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur interne' });
    }
};

// Obtenir tous les QR Codes de l'organisation
exports.getAllQrs = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const qrs = await qrService.getAllQrsForOrg(req.user.org_id);

        // Formatage pour le frontend
        const formattedQrs = qrs.map(qr => {
            const now = new Date();
            let state = qr.status;
            if (qr.valid_until && new Date(qr.valid_until) < now) state = 'expired';
            if (qr.scans_count >= qr.usage_limit) state = 'exhausted';

            return {
                id: qr.qr_id,
                holder: qr.holder_name || "Inconnu",
                email: qr.holder_email || "-",
                event: qr.event?.title || "-",
                status: state,
                scans: `${qr.scans_count} / ${qr.usage_limit > 9999 ? '∞' : qr.usage_limit}`,
                token: qr.unique_token,
                createdAt: new Date(qr.valid_from || new Date()).toLocaleDateString() // Using valid_from roughly as creation or start
            };
        });

        return res.status(200).json({ success: true, qrs: formattedQrs });
    } catch (error) {
        console.error("Erreur lors de la récupération des QR :", error);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

// Obtenir tous les QR Codes pour un événement spécifique
exports.getQrsByEvent = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }
        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);

        const event = await eventService.findById(orgId, eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Événement introuvable" });
        }

        const qrs = await qrService.getQrsByEventId(orgId, eventId);

        const formattedQrs = qrs.map(qr => {
            const now = new Date();
            let state = qr.status;
            if (qr.valid_until && new Date(qr.valid_until) < now) state = 'expired';
            if (qr.scans_count >= qr.usage_limit) state = 'exhausted';
            return {
                id: qr.qr_id,
                holder: qr.holder_name || "Inconnu",
                email: qr.holder_email || "-",
                phone: qr.holder_phone || "-",
                status: state,
                scans: `${qr.scans_count} / ${qr.usage_limit > 9999 ? '∞' : qr.usage_limit}`,
                scans_count: qr.scans_count,
                usage_limit: qr.usage_limit,
                token: qr.unique_token,
                createdAt: new Date(qr.valid_from || new Date()).toLocaleDateString()
            };
        });

        return res.status(200).json({ success: true, qrs: formattedQrs });
    } catch (error) {
        console.error("Erreur lors de la récupération des QR par événement :", error);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

// Révocation d'un QR code
exports.revokeQr = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const qrId = Number(req.params.id);

        const qr = await qrService.getQrById(qrId);
        if (!qr) {
            return res.status(404).json({ success: false, message: "QR Code introuvable" });
        }

        // Vérification que le QR code appartient bien à un événement de l'organisation
        const event = await eventService.findById(orgId, qr.event_id);
        if (!event) {
            return res.status(403).json({ success: false, message: "Accès refusé" });
        }

        await qrService.updateQr(qrId, { status: "revoked" });

        return res.status(200).json({ success: true, message: "QR Code révoqué avec succès" });
    } catch (error) {
        console.error("Erreur lors de la révocation du QR:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur interne" });
    }
};

exports.importQrsFromCSV = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "Fichier CSV requis" });
        }

        const event = await eventService.findById(orgId, eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Événement non trouvé" });
        }

        const results = [];
        const processStream = new Promise((resolve, reject) => {
            fs.createReadStream(file.path)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('error', (err) => reject(err))
                .on('end', () => resolve(results));
        });

        const rows = await processStream;
        const createdQrs = [];

        for (const row of rows) {
            const fullName = row.fullName || row.name || row.nom;
            const email = row.email;
            const phone = row.phone || row.telephone;
            const accessType = row.accessType || 'single';
            const limit = Number(row.limit) || 1;
            const level = Number(row.level) || 1;
            const validFrom = row.validFrom ? new Date(row.validFrom) : null;
            const validUntil = row.validUntil ? new Date(row.validUntil) : null;

            if (!fullName) continue;

            const uniqueToken = crypto.randomUUID();
            let usageLimit = 1;
            if (accessType === 'multi') usageLimit = limit;
            if (accessType === 'unlimited') usageLimit = 999999;

            const qrRecord = await qrService.createQr({
                unique_token: uniqueToken,
                status: "active",
                usage_limit: usageLimit,
                valid_from: validFrom,
                valid_until: validUntil,
                level: level,
                holder_name: fullName,
                holder_email: email || null,
                holder_phone: phone || null,
                event_id: eventId
            });

            // Générer le QR physique
            const qrData = JSON.stringify({ t: uniqueToken, e: eventId });
            const qrFilename = `qr_${uniqueToken}.png`;
            const qrPath = path.join(__dirname, '../statics/qrcodes', qrFilename);

            if (!fs.existsSync(path.dirname(qrPath))) fs.mkdirSync(path.dirname(qrPath), { recursive: true });

            await QRCode.toFile(qrPath, qrData, {
                errorCorrectionLevel: 'H',
                margin: 2,
                width: 400
            });

            createdQrs.push(qrRecord);
        }

        // Nettoyer le fichier téléchargé
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        return res.status(201).json({
            success: true,
            message: `${createdQrs.length} QR Codes importés avec succès`,
            count: createdQrs.length
        });


    } catch (error) {
        console.error("Erreur lors de l'importation CSV :", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ success: false, message: "Erreur lors de l'importation" });
    }
};
