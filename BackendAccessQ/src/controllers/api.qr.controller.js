const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
const eventService = require('../services/event.service');
const qrService = require('../services/qr.service');
const cardTemplateService = require('../services/card_template.service');
const customCardTemplateService = require('../services/custom_card_template.service');

const buildQrPayload = (uniqueToken, eventId) => JSON.stringify({ t: uniqueToken, e: eventId });

const qrUrlForToken = (token) => `/qrcodes/qr_${token}.png`;

const qrPathForToken = (token) => path.join(__dirname, '../statics/qrcodes', `qr_${token}.png`);

const ensureQrImageForToken = async ({ uniqueToken, eventId }) => {
    const qrPath = qrPathForToken(uniqueToken);
    const dir = path.dirname(qrPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await QRCode.toFile(qrPath, buildQrPayload(uniqueToken, eventId), {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 400
    });

    return qrUrlForToken(uniqueToken);
};

const cardPdfUrlForToken = (token) => (
    typeof cardTemplateService.cardPdfUrlForToken === "function"
        ? cardTemplateService.cardPdfUrlForToken(token)
        : `/cards/card_${token}.pdf`
);

const cardPdfExistsForToken = (token) => (
    typeof cardTemplateService.cardPdfExistsForToken === "function"
        ? cardTemplateService.cardPdfExistsForToken(token)
        : false
);

const resolveCardTemplate = async (orgId, cardTemplateId) => {
    if (!cardTemplateId) return null;
    if (cardTemplateService.hasTemplate(cardTemplateId)) {
        return { sourceTemplateId: cardTemplateId, templateId: cardTemplateId, version: 1 };
    }

    const customTemplate = await customCardTemplateService.resolveCustomForRender(orgId, cardTemplateId);
    if (!customTemplate) return null;

    return {
        sourceTemplateId: cardTemplateId,
        templateId: customTemplate.baseTemplateId,
        version: customTemplate.version || 1,
        customization: customTemplate
    };
};

const createTemplateSnapshot = (resolvedTemplate) => resolvedTemplate ? {
    schemaVersion: 1,
    sourceTemplateId: resolvedTemplate.sourceTemplateId,
    baseTemplateId: resolvedTemplate.templateId,
    version: resolvedTemplate.version || 1,
    customization: resolvedTemplate.customization || null
} : null;

const resolveTemplateSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object" || snapshot.schemaVersion !== 1) return null;
    if (!snapshot.sourceTemplateId || !snapshot.baseTemplateId) return null;
    return {
        sourceTemplateId: snapshot.sourceTemplateId,
        templateId: snapshot.baseTemplateId,
        version: Number(snapshot.version) || 1,
        customization: snapshot.customization || undefined
    };
};

const normalizeCardData = (value = {}) => {
    const source = value && typeof value === "object" ? value : {};
    return {
        spouseOne: String(source.spouseOne || "").trim().slice(0, 80),
        spouseTwo: String(source.spouseTwo || "").trim().slice(0, 80),
        zone: String(source.zone || "").trim().slice(0, 80),
        address: String(source.address || "").trim().slice(0, 140)
    };
};

// Générer un QR Code
exports.generateQrForEvent = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);
        const { fullName, email, phone, accessType, limit, validFrom, validUntil, level, cardMessage } = req.body;
        const hasRequestedTemplate = Object.prototype.hasOwnProperty.call(req.body, "cardTemplateId");
        const cardTemplateId = hasRequestedTemplate ? req.body.cardTemplateId : await customCardTemplateService.getDefaultForOrg(orgId);
        const cardData = normalizeCardData(req.body.cardData);

        if (!fullName || !accessType) {
            return res.status(400).json({ success: false, message: "Nom complet et Type d'accès requis" });
        }

        const resolvedCardTemplate = cardTemplateId ? await resolveCardTemplate(orgId, cardTemplateId) : null;
        if (cardTemplateId && !resolvedCardTemplate) {
            return res.status(400).json({ success: false, message: "Modèle de carte invalide." });
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
            card_data: cardTemplateId ? cardData : undefined,
            card_template_id: cardTemplateId || null,
            card_template_version: resolvedCardTemplate?.version || null,
            card_template_snapshot: createTemplateSnapshot(resolvedCardTemplate),
            card_message: cardTemplateId ? String(cardMessage || "").trim().slice(0, 160) || null : null,
            card_generation_status: cardTemplateId ? "PENDING" : null,
            event_id: event.event_id
        });

        const qrUrl = await ensureQrImageForToken({
            uniqueToken,
            eventId: event.event_id
        });
        let cardUrl = null;
        let cardPdfUrl = null;

        if (cardTemplateId) {
            try {
                cardUrl = await cardTemplateService.generateCardForQr({
                    templateId: resolvedCardTemplate.templateId,
                    customization: resolvedCardTemplate.customization,
                    event, qrRecord, qrUrl, cardMessage, cardData
                });
                cardPdfUrl = cardPdfUrlForToken(uniqueToken);
                await qrService.updateQr(qrRecord.qr_id, {
                    card_generated_at: new Date(), card_generation_status: "READY", card_generation_error: null
                });
            } catch (generationError) {
                await qrService.updateQr(qrRecord.qr_id, {
                    card_generation_status: "FAILED",
                    card_generation_error: String(generationError.message || "Échec de génération").slice(0, 500)
                });
                throw generationError;
            }
        }

        return res.status(201).json({
            success: true,
            message: 'QR Code généré et sauvegardé avec succès',
            qrUrl: qrUrl,
            cardUrl,
            cardPdfUrl,
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
                cardUrl: cardTemplateService.cardExistsForToken(qr.unique_token) ? cardTemplateService.cardUrlForToken(qr.unique_token) : null,
                cardPdfUrl: cardPdfExistsForToken(qr.unique_token) ? cardPdfUrlForToken(qr.unique_token) : null,
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
                cardUrl: cardTemplateService.cardExistsForToken(qr.unique_token) ? cardTemplateService.cardUrlForToken(qr.unique_token) : null,
                cardPdfUrl: cardPdfExistsForToken(qr.unique_token) ? cardPdfUrlForToken(qr.unique_token) : null,
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

// Restauration d'un QR code révoqué
exports.restoreQr = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const qrId = Number(req.params.id);

        const qr = await qrService.getQrById(qrId);
        if (!qr || qr.deleted_at) {
            return res.status(404).json({ success: false, message: "QR Code introuvable" });
        }

        const event = await eventService.findById(orgId, qr.event_id);
        if (!event) {
            return res.status(403).json({ success: false, message: "Accès refusé" });
        }

        if (qr.status !== "revoked") {
            return res.status(400).json({ success: false, message: "Seuls les QR révoqués peuvent être restaurés." });
        }

        const now = new Date();
        if (qr.valid_until && new Date(qr.valid_until) < now) {
            return res.status(400).json({ success: false, message: "Impossible de restaurer un QR expiré." });
        }

        if (qr.scans_count >= qr.usage_limit) {
            return res.status(400).json({ success: false, message: "Impossible de restaurer un QR dont la limite de scans est atteinte." });
        }

        await qrService.updateQr(qrId, { status: "active" });

        return res.status(200).json({ success: true, message: "QR Code restauré avec succès" });
    } catch (error) {
        console.error("Erreur lors de la restauration du QR:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur interne" });
    }
};

exports.downloadQrImportTemplate = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);

        const event = await eventService.findById(orgId, eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Événement non trouvé" });
        }

        const headers = [
            "fullName",
            "email",
            "phone",
            "accessType",
            "limit",
            "validFrom",
            "validUntil",
            "level",
            "cardTemplateId",
            "cardMessage"
        ];

        const filename = `modele_import_qr_evenement_${eventId}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(`${headers.join(",")}\n`);
    } catch (error) {
        console.error("Erreur lors du téléchargement du modèle CSV :", error);
        return res.status(500).json({ success: false, message: "Erreur lors du téléchargement du modèle" });
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
        const validationErrors = [];
        const resolvedTemplates = new Map();

        for (const [index, row] of rows.entries()) {
            const line = index + 2;
            const fullName = String(row.fullName || row.name || row.nom || "").trim();
            const accessType = row.accessType || "single";
            const cardTemplateId = row.cardTemplateId || row.card_template_id || row.templateId || "";
            if (!fullName) validationErrors.push({ line, field: "fullName", message: "Nom complet requis." });
            if (!["single", "multi", "unlimited"].includes(accessType)) validationErrors.push({ line, field: "accessType", message: "Type d’accès invalide." });
            if (row.validFrom && Number.isNaN(new Date(row.validFrom).getTime())) validationErrors.push({ line, field: "validFrom", message: "Date de début invalide." });
            if (row.validUntil && Number.isNaN(new Date(row.validUntil).getTime())) validationErrors.push({ line, field: "validUntil", message: "Date de fin invalide." });
            if (cardTemplateId && !resolvedTemplates.has(cardTemplateId)) {
                resolvedTemplates.set(cardTemplateId, await resolveCardTemplate(orgId, cardTemplateId));
            }
            if (cardTemplateId && !resolvedTemplates.get(cardTemplateId)) validationErrors.push({ line, field: "cardTemplateId", message: "Modèle introuvable ou non autorisé." });
        }

        if (validationErrors.length) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(422).json({
                success: false,
                message: "Import annulé : aucune ligne n’a été créée.",
                totalRows: rows.length,
                errors: validationErrors
            });
        }

        for (const row of rows) {
            const fullName = row.fullName || row.name || row.nom;
            const email = row.email;
            const phone = row.phone || row.telephone;
            const accessType = row.accessType || 'single';
            const limit = Number(row.limit) || 1;
            const level = Number(row.level) || 1;
            const validFrom = row.validFrom ? new Date(row.validFrom) : null;
            const validUntil = row.validUntil ? new Date(row.validUntil) : null;
            const cardTemplateId = row.cardTemplateId || row.card_template_id || row.templateId || "";
            const cardMessage = row.cardMessage || row.card_message || "";

            const resolvedCardTemplate = cardTemplateId ? resolvedTemplates.get(cardTemplateId) : null;

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
                card_template_id: cardTemplateId || null,
                card_template_version: resolvedCardTemplate?.version || null,
                card_template_snapshot: createTemplateSnapshot(resolvedCardTemplate),
                card_message: cardTemplateId ? String(cardMessage).trim().slice(0, 160) || null : null,
                card_generation_status: cardTemplateId ? "PENDING" : null,
                event_id: eventId
            });

            const qrUrl = await ensureQrImageForToken({ uniqueToken, eventId });

            if (cardTemplateId) {
                await cardTemplateService.generateCardForQr({
                    templateId: resolvedCardTemplate.templateId,
                    customization: resolvedCardTemplate.customization,
                    event,
                    qrRecord,
                    qrUrl,
                    cardMessage
                });
                await qrService.updateQr(qrRecord.qr_id, {
                    card_generated_at: new Date(), card_generation_status: "READY", card_generation_error: null
                });
            }

            createdQrs.push(qrRecord);
        }

        // Nettoyer le fichier téléchargé
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        return res.status(201).json({
            success: true,
            message: `${createdQrs.length} QR Codes importés avec succès`,
            count: createdQrs.length,
            totalRows: rows.length,
            errors: []
        });


    } catch (error) {
        console.error("Erreur lors de l'importation CSV :", error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ success: false, message: "Erreur lors de l'importation" });
    }
};

exports.generateCardForExistingQr = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const qrId = Number(req.params.id);
        const requestedCardMessage = req.body.cardMessage;
        const requestedCardData = req.body.cardData;
        const requestedTemplateId = String(req.body.cardTemplateId || "").trim();
        const requestedTemplate = requestedTemplateId
            ? await resolveCardTemplate(orgId, requestedTemplateId)
            : null;
        if (requestedTemplateId && !requestedTemplate) {
            return res.status(400).json({ success: false, message: "Modèle de carte invalide." });
        }

        const qrRecord = await qrService.getQrById(qrId);
        if (!qrRecord || qrRecord.deleted_at) {
            return res.status(404).json({ success: false, message: "QR Code introuvable" });
        }
        const cardData = normalizeCardData(requestedCardData ?? qrRecord.card_data);
        const cardMessage = String(requestedCardMessage ?? qrRecord.card_message ?? "").trim().slice(0, 160);

        const event = await eventService.findById(orgId, qrRecord.event_id);
        if (!event) {
            return res.status(403).json({ success: false, message: "Accès refusé" });
        }

        const fallbackTemplateId = requestedTemplateId || qrRecord.card_template_id || await customCardTemplateService.getDefaultForOrg(orgId);
        const resolvedCardTemplate = !requestedTemplateId
            ? resolveTemplateSnapshot(qrRecord.card_template_snapshot) || await resolveCardTemplate(orgId, fallbackTemplateId)
            : requestedTemplate;
        if (!fallbackTemplateId || !resolvedCardTemplate) {
            return res.status(400).json({ success: false, message: "Modèle de carte invalide." });
        }

        const qrUrl = fs.existsSync(qrPathForToken(qrRecord.unique_token))
            ? qrUrlForToken(qrRecord.unique_token)
            : await ensureQrImageForToken({ uniqueToken: qrRecord.unique_token, eventId: qrRecord.event_id });

        const cardUrl = await cardTemplateService.generateCardForQr({
            templateId: resolvedCardTemplate.templateId,
            customization: resolvedCardTemplate.customization,
            event,
            qrRecord,
            qrUrl,
            cardMessage,
            cardData
        });

        await qrService.updateQr(qrId, {
            card_template_id: resolvedCardTemplate.sourceTemplateId,
            card_template_version: resolvedCardTemplate.version || 1,
            card_template_snapshot: createTemplateSnapshot(resolvedCardTemplate),
            card_generated_at: new Date(),
            card_message: cardMessage || null,
            card_generation_status: "READY",
            card_generation_error: null,
            card_data: cardData
        });

        return res.status(201).json({
            success: true,
            message: "Carte générée avec succès",
            cardUrl,
            cardPdfUrl: cardPdfUrlForToken(qrRecord.unique_token)
        });
    } catch (error) {
        console.error("Erreur lors de la génération de la carte :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la génération de la carte" });
    }
};
