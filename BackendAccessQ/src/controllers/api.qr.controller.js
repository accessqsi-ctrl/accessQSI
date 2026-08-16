const QRCode = require("qrcode");
const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
const eventService = require('../services/event.service');
const qrService = require('../services/qr.service');
const cardTemplateService = require('../services/card_template.service');
const customCardTemplateService = require('../services/custom_card_template.service');
const storageService = require("../services/storage.service");
const { validateQrPayload } = require("../services/qr_validation.service");
const {
    getEffectiveQrStatus,
    usageLimitFromAccessType,
    formatUsageLimit
} = require("../services/qr_status.service");
const { getPlanContextForUser } = require("../utils/planAccess");
const {
    PLAN_CAPABILITIES,
    hasPlanCapability
} = require("../config/subscription");
const { withEventQrQuota } = require("../services/organization_quota.service");

const buildQrPayload = (uniqueToken, eventId) => JSON.stringify({ t: uniqueToken, e: eventId });

const MAX_EVENT_PDF_PAGES = 200;

const qrDownloadUrlForId = (qrId) => `/qr/image/${qrId}`;

const cardDownloadUrlForId = (qrId) => `/qr/card/${qrId}/download`;

const qrDataUrl = async (qrRecord) => {
    const image = await QRCode.toBuffer(buildQrPayload(qrRecord.unique_token, qrRecord.event_id), {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 400
    });
    return `data:image/png;base64,${image.toString("base64")}`;
};

const isCustomTemplateId = (cardTemplateId) => {
    return Boolean(cardTemplateService.extractCustomTemplateId?.(cardTemplateId))
        || String(cardTemplateId || "").startsWith("custom:");
};

const assertCustomTemplateAccess = (planContext, cardTemplateId) => {
    if (
        isCustomTemplateId(cardTemplateId)
        && !hasPlanCapability(planContext, PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES)
    ) {
        const error = new Error("Les modèles personnalisés nécessitent un abonnement Pro.");
        error.code = "PLAN_CAPABILITY_REQUIRED";
        error.plan = planContext.plan;
        error.planName = planContext.planName;
        throw error;
    }
};

const resolveCardTemplate = async (orgId, cardTemplateId, planContext) => {
    if (!cardTemplateId) return null;
    if (cardTemplateService.isTemplateAvailable?.(cardTemplateId) || (!cardTemplateService.isTemplateAvailable && cardTemplateService.hasTemplate(cardTemplateId))) {
        return { sourceTemplateId: cardTemplateId, templateId: cardTemplateId };
    }

    assertCustomTemplateAccess(planContext, cardTemplateId);
    const customTemplate = await customCardTemplateService.resolveCustomForRender(orgId, cardTemplateId);
    if (!customTemplate) return null;

    return {
        sourceTemplateId: cardTemplateId,
        templateId: customTemplate.baseTemplateId,
        customization: customTemplate
    };
};

const createTemplateSnapshot = (resolvedTemplate) => resolvedTemplate ? {
    schemaVersion: 1,
    sourceTemplateId: resolvedTemplate.sourceTemplateId,
    baseTemplateId: resolvedTemplate.templateId,
    customization: resolvedTemplate.customization || null
} : null;

const resolveTemplateSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object" || snapshot.schemaVersion !== 1) return null;
    if (!snapshot.sourceTemplateId || !snapshot.baseTemplateId) return null;
    return {
        sourceTemplateId: snapshot.sourceTemplateId,
        templateId: snapshot.baseTemplateId,
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

const importErrorMessage = (error) => String(error?.message || "Erreur inattendue").slice(0, 300);

const safeDownloadName = (value, fallback) => {
    const normalized = String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return normalized || fallback;
};

const resolveStoredCardTemplate = async ({ orgId, qrRecord, planContext }) => {
    const snapshotTemplate = resolveTemplateSnapshot(qrRecord.card_template_snapshot);
    if (snapshotTemplate) {
        assertCustomTemplateAccess(planContext, snapshotTemplate.sourceTemplateId);
        return snapshotTemplate;
    }

    const templateId = qrRecord.card_template_id || "event-ticket";
    return resolveCardTemplate(orgId, templateId, planContext);
};

const buildCardRenderInput = async ({ orgId, event, qrRecord, planContext }) => {
    const resolvedTemplate = await resolveStoredCardTemplate({ orgId, qrRecord, planContext });
    if (!resolvedTemplate) {
        const error = new Error("Le modèle associé à cette carte est introuvable.");
        error.code = "CARD_TEMPLATE_NOT_FOUND";
        throw error;
    }

    return {
        templateId: resolvedTemplate.templateId,
        customization: resolvedTemplate.customization,
        event,
        qrRecord,
        qrUrl: await qrDataUrl(qrRecord),
        cardMessage: qrRecord.card_message,
        cardData: qrRecord.card_data
    };
};

exports.downloadQrImage = async (req, res) => {
    try {
        if (!req.user?.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const qrRecord = await qrService.getQrById(Number(req.params.id));
        if (!qrRecord || qrRecord.deleted_at) {
            return res.status(404).json({ success: false, message: "QR Code introuvable" });
        }
        const event = await eventService.findById(req.user.org_id, qrRecord.event_id);
        if (!event) {
            return res.status(403).json({ success: false, message: "Accès refusé" });
        }

        const image = await QRCode.toBuffer(buildQrPayload(qrRecord.unique_token, qrRecord.event_id), {
            errorCorrectionLevel: "H",
            margin: 2,
            width: 400
        });
        const filename = `qr-${safeDownloadName(qrRecord.holder_name, String(qrRecord.qr_id))}.png`;
        res.setHeader("Content-Type", "image/png");
        const disposition = req.query.download === "1" ? "attachment" : "inline";
        res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, max-age=300");
        return res.status(200).send(image);
    } catch (error) {
        console.error("Erreur lors de la génération du QR à la demande :", error);
        return res.status(500).json({ success: false, message: "Impossible de générer le QR Code" });
    }
};

exports.downloadCardPdf = async (req, res) => {
    try {
        if (!req.user?.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const qrRecord = await qrService.getQrById(Number(req.params.id));
        if (!qrRecord || qrRecord.deleted_at) {
            return res.status(404).json({ success: false, message: "QR Code introuvable" });
        }
        const event = await eventService.findById(orgId, qrRecord.event_id);
        if (!event) {
            return res.status(403).json({ success: false, message: "Accès refusé" });
        }

        const planContext = req.planContext || await getPlanContextForUser(req);
        const card = await buildCardRenderInput({ orgId, event, qrRecord, planContext });
        const filename = `badge-${safeDownloadName(qrRecord.holder_name, String(qrRecord.qr_id))}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, no-store");
        await cardTemplateService.streamCardsPdf({ cards: [card], output: res });
    } catch (error) {
        if (res.headersSent) {
            return res.destroy(error);
        }
        if (error.code === "PLAN_CAPABILITY_REQUIRED") {
            return res.status(403).json({
                success: false,
                message: error.message,
                upgradeRequired: true
            });
        }
        const status = error.code === "CARD_TEMPLATE_NOT_FOUND" ? 422 : 500;
        console.error("Erreur lors de la génération du badge PDF :", error);
        return res.status(status).json({ success: false, message: error.message || "Impossible de générer le badge" });
    }
};

exports.downloadEventCardsPdf = async (req, res) => {
    try {
        if (!req.user?.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);
        const event = await eventService.findById(orgId, eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Événement introuvable" });
        }

        const totalQr = await qrService.countQrsByEventId(orgId, eventId);
        const totalFiles = Math.max(1, Math.ceil(totalQr / MAX_EVENT_PDF_PAGES));
        const file = Math.max(1, Number.parseInt(req.query.file, 10) || 1);
        if (file > totalFiles) {
            return res.status(404).json({ success: false, message: "Cette partie du PDF n’existe pas." });
        }
        const qrRecords = await qrService.getAllQrsByEventId(orgId, eventId, {
            take: MAX_EVENT_PDF_PAGES,
            skip: (file - 1) * MAX_EVENT_PDF_PAGES
        });
        if (!qrRecords.length) {
            return res.status(404).json({ success: false, message: "Aucun QR à inclure dans le PDF" });
        }
        const planContext = req.planContext || await getPlanContextForUser(req);
        const cards = [];
        for (const qrRecord of qrRecords) {
            cards.push(await buildCardRenderInput({ orgId, event, qrRecord, planContext }));
        }

        const partSuffix = totalFiles > 1 ? `-partie-${file}-sur-${totalFiles}` : "";
        const filename = `badges-${safeDownloadName(event.title, String(eventId))}${partSuffix}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-PDF-File", String(file));
        res.setHeader("X-PDF-Total-Files", String(totalFiles));
        res.setHeader("X-PDF-Total-Pages", String(totalQr));
        await cardTemplateService.streamCardsPdf({ cards, output: res });
    } catch (error) {
        if (res.headersSent) {
            return res.destroy(error);
        }
        if (error.code === "PLAN_CAPABILITY_REQUIRED") {
            return res.status(403).json({
                success: false,
                message: error.message,
                upgradeRequired: true
            });
        }
        const status = error.code === "CARD_TEMPLATE_NOT_FOUND" ? 422 : 500;
        console.error("Erreur lors de la génération du PDF de l’événement :", error);
        return res.status(status).json({ success: false, message: error.message || "Impossible de générer le PDF" });
    }
};

// Générer un QR Code
exports.generateQrForEvent = async (req, res) => {
    let qrRecord = null;
    let uniqueToken = null;
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);
        const planContext = req.planContext || await getPlanContextForUser(req);
        const validation = validateQrPayload(req.body);
        if (validation.errors.length > 0) {
            return res.status(422).json({
                success: false,
                message: "Données QR invalides.",
                errors: validation.errors
            });
        }
        const {
            fullName, email, phone, accessType, limit,
            validFrom, validUntil, level, cardMessage
        } = validation.values;

        const hasRequestedTemplate = Object.prototype.hasOwnProperty.call(req.body, "cardTemplateId");
        let cardTemplateId = hasRequestedTemplate
            ? validation.values.cardTemplateId
            : await customCardTemplateService.getDefaultForOrg(orgId);
        if (!hasRequestedTemplate && isCustomTemplateId(cardTemplateId)) {
            const canUseCustomTemplates = hasPlanCapability(
                planContext,
                PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES
            );
            if (!canUseCustomTemplates) cardTemplateId = "";
        }
        const cardData = normalizeCardData(req.body.cardData);

        const resolvedCardTemplate = cardTemplateId
            ? await resolveCardTemplate(orgId, cardTemplateId, planContext)
            : null;
        if (cardTemplateId && !resolvedCardTemplate) {
            return res.status(400).json({ success: false, message: "Modèle de carte invalide." });
        }

        // Vérifier que l'événement appartient à l'organisation de l'utilisateur
        const event = await eventService.findById(orgId, eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Événement non trouvé ou accès refusé' });
        }

        // Générer un jeton sécurisé par cryptographie
        uniqueToken = crypto.randomUUID();
        const usageLimit = usageLimitFromAccessType(accessType, limit);

        const qrData = {
            unique_token: uniqueToken,
            status: "active",
            usage_limit: usageLimit,
            valid_from: validFrom,
            valid_until: validUntil,
            level,
            holder_name: fullName,
            holder_email: email || null,
            holder_phone: phone || null,
            card_data: cardTemplateId ? cardData : undefined,
            card_template_id: cardTemplateId || null,
            card_template_snapshot: createTemplateSnapshot(resolvedCardTemplate),
            card_message: cardTemplateId ? cardMessage || null : null,
            card_generation_status: cardTemplateId ? "PENDING" : null,
            event_id: event.event_id
        };
        qrRecord = await withEventQrQuota({
            organizationId: orgId,
            eventId,
            create: (tx) => qrService.createQr(qrData, tx)
        });

        const qrUrl = qrDownloadUrlForId(qrRecord.qr_id);
        const cardUrl = null;
        const cardPdfUrl = cardTemplateId ? cardDownloadUrlForId(qrRecord.qr_id) : null;

        if (cardTemplateId) {
            await qrService.updateQr(qrRecord.qr_id, {
                card_generated_at: null,
                card_generation_status: "ON_DEMAND",
                card_generation_error: null
            });
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
        if (error.code === "PLAN_QUOTA_EXCEEDED") {
            return res.status(403).json({
                success: false,
                message: `Le quota de QR de cet événement est atteint (${error.currentCount}/${error.limit}).`,
                plan: error.plan,
                planName: error.planName,
                upgradeRequired: true
            });
        }
        if (error.code === "EVENT_PASS_EXPIRED") {
            return res.status(403).json({ success: false, code: error.code, message: error.message });
        }
        if (error.code === "PLAN_CAPABILITY_REQUIRED") {
            return res.status(403).json({
                success: false,
                message: error.message,
                plan: error.plan,
                planName: error.planName,
                upgradeRequired: true
            });
        }
        console.error('Erreur lors de la génération du QR:', error);
        if (qrRecord) {
            await Promise.allSettled([
                qrService.deleteQrPermanently?.(qrRecord.qr_id),
                storageService.removeQrAssets(uniqueToken)
            ]);
        }
        return res.status(500).json({ success: false, message: 'Erreur serveur interne' });
    }
};

// Obtenir tous les QR Codes de l'organisation
exports.getAllQrs = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const result = await qrService.getAllQrsForOrg(req.user.org_id, {
            page: req.query.page,
            pageSize: req.query.pageSize,
            search: req.query.search,
            status: req.query.status
        });
        const qrs = Array.isArray(result) ? result : result.items;

        // Formatage pour le frontend
        const formattedQrs = qrs.map(qr => {
            return {
                id: qr.qr_id,
                holder: qr.holder_name || "Inconnu",
                email: qr.holder_email || "-",
                event: qr.event?.title || "-",
                status: getEffectiveQrStatus(qr),
                scans: `${qr.scans_count} / ${formatUsageLimit(qr.usage_limit)}`,
                token: qr.unique_token,
                qrUrl: qrDownloadUrlForId(qr.qr_id),
                cardUrl: null,
                cardPdfUrl: qr.card_template_id ? cardDownloadUrlForId(qr.qr_id) : null,
                createdAt: new Date(qr.created_at).toLocaleDateString()
            };
        });

        return res.status(200).json({
            success: true,
            qrs: formattedQrs,
            pagination: Array.isArray(result) ? null : result.pagination
        });
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

        const result = await qrService.getQrsByEventId(orgId, eventId, {
            page: req.query.page,
            pageSize: req.query.pageSize,
            search: req.query.search,
            status: req.query.status
        });
        const qrs = Array.isArray(result) ? result : result.items;

        const formattedQrs = qrs.map(qr => {
            return {
                id: qr.qr_id,
                holder: qr.holder_name || "Inconnu",
                email: qr.holder_email || "-",
                phone: qr.holder_phone || "-",
                status: getEffectiveQrStatus(qr),
                scans: `${qr.scans_count} / ${formatUsageLimit(qr.usage_limit)}`,
                scans_count: qr.scans_count,
                usage_limit: qr.usage_limit,
                token: qr.unique_token,
                qrUrl: qrDownloadUrlForId(qr.qr_id),
                cardUrl: null,
                cardPdfUrl: qr.card_template_id ? cardDownloadUrlForId(qr.qr_id) : null,
                createdAt: new Date(qr.created_at).toLocaleDateString()
            };
        });

        return res.status(200).json({
            success: true,
            qrs: formattedQrs,
            pagination: Array.isArray(result) ? null : result.pagination
        });
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

        if (qr.usage_limit > 0 && qr.scans_count >= qr.usage_limit) {
            return res.status(400).json({ success: false, message: "Impossible de restaurer un QR dont la limite de scans est atteinte." });
        }

        await qrService.updateQr(qrId, { status: "active" });

        return res.status(200).json({ success: true, message: "QR Code restauré avec succès" });
    } catch (error) {
        console.error("Erreur lors de la restauration du QR:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur interne" });
    }
};

// Recharge additive d'un QR limité, sans effacer sa consommation ni son historique.
exports.rechargeQr = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const qrId = Number(req.params.id);
        const amount = Number(req.body.amount);

        if (!Number.isInteger(qrId) || qrId <= 0) {
            return res.status(400).json({ success: false, message: "Identifiant du QR invalide." });
        }
        if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
            return res.status(422).json({
                success: false,
                message: "Le nombre de passages à ajouter doit être un entier compris entre 1 et 1 000 000."
            });
        }

        const qr = await qrService.getQrById(qrId);
        if (!qr || qr.deleted_at) {
            return res.status(404).json({ success: false, message: "QR Code introuvable" });
        }

        const event = await eventService.findById(orgId, qr.event_id);
        if (!event) {
            return res.status(403).json({ success: false, message: "Accès refusé" });
        }
        if (qr.status === "revoked") {
            return res.status(400).json({ success: false, message: "Un QR révoqué doit d’abord être restauré." });
        }
        if (qr.status === "expired" || (qr.valid_until && new Date(qr.valid_until) < new Date())) {
            return res.status(400).json({ success: false, message: "Impossible de recharger un QR expiré." });
        }
        if (qr.usage_limit === 0) {
            return res.status(400).json({ success: false, message: "Ce QR possède déjà un accès illimité." });
        }

        const updatedQr = await qrService.updateQr(qrId, {
            usage_limit: { increment: amount },
            status: "active"
        });
        const usageLimit = Number(updatedQr?.usage_limit ?? qr.usage_limit + amount);
        const scansCount = Number(updatedQr?.scans_count ?? qr.scans_count);

        return res.status(200).json({
            success: true,
            message: `${amount} passage${amount > 1 ? "s" : ""} ajouté${amount > 1 ? "s" : ""} avec succès.`,
            qr: {
                id: qrId,
                status: "active",
                scans_count: scansCount,
                usage_limit: usageLimit,
                scans: `${scansCount} / ${usageLimit}`,
                remaining: Math.max(0, usageLimit - scansCount)
            }
        });
    } catch (error) {
        console.error("Erreur lors de la recharge du QR:", error);
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
    const file = req.file;
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);
        const planContext = req.planContext || await getPlanContextForUser(req);

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
        const resolvedTemplates = new Map();
        const resultsByLine = [];
        const errors = [];
        let createdCount = 0;
        let completedCount = 0;

        for (const [index, row] of rows.entries()) {
            const line = index + 2;
            const validation = validateQrPayload(row, { line });
            const { values } = validation;
            let resolvedCardTemplate = null;

            if (values.cardTemplateId) {
                try {
                    if (!resolvedTemplates.has(values.cardTemplateId)) {
                        resolvedTemplates.set(
                            values.cardTemplateId,
                            await resolveCardTemplate(orgId, values.cardTemplateId, planContext)
                        );
                    }
                    resolvedCardTemplate = resolvedTemplates.get(values.cardTemplateId);
                    if (!resolvedCardTemplate) {
                        validation.errors.push({
                            line,
                            field: "cardTemplateId",
                            message: "Modèle introuvable ou non autorisé."
                        });
                    }
                } catch (error) {
                    validation.errors.push({
                        line,
                        field: "cardTemplateId",
                        message: importErrorMessage(error)
                    });
                }
            }

            if (validation.errors.length > 0) {
                errors.push(...validation.errors.map(error => ({ ...error, stage: "validation" })));
                resultsByLine.push({
                    line,
                    status: "failed",
                    holder: values.fullName || null,
                    errors: validation.errors
                });
                continue;
            }

            let qrRecord = null;
            try {
                const uniqueToken = crypto.randomUUID();
                const usageLimit = usageLimitFromAccessType(values.accessType, values.limit);

                qrRecord = await withEventQrQuota({
                    organizationId: orgId,
                    eventId,
                    create: (tx) => qrService.createQr({
                    unique_token: uniqueToken,
                    status: "active",
                    usage_limit: usageLimit,
                    valid_from: values.validFrom,
                    valid_until: values.validUntil,
                    level: values.level,
                    holder_name: values.fullName,
                    holder_email: values.email,
                    holder_phone: values.phone,
                    card_template_id: values.cardTemplateId || null,
                    card_template_snapshot: createTemplateSnapshot(resolvedCardTemplate),
                    card_message: values.cardTemplateId ? values.cardMessage || null : null,
                    card_generation_status: values.cardTemplateId ? "PENDING" : null,
                    event_id: eventId
                    }, tx)
                });
                if (values.cardTemplateId) {
                    await qrService.updateQr(qrRecord.qr_id, {
                        card_generated_at: null,
                        card_generation_status: "ON_DEMAND",
                        card_generation_error: null
                    });
                }

                createdCount += 1;
                completedCount += 1;
                resultsByLine.push({
                    line,
                    status: "created",
                    qrId: qrRecord.qr_id,
                    holder: values.fullName
                });
            } catch (error) {
                const detail = {
                    line,
                    stage: qrRecord ? "asset_generation" : "database",
                    message: importErrorMessage(error),
                    ...(qrRecord ? { qrId: qrRecord.qr_id } : {})
                };
                let rollbackFailed = false;
                if (qrRecord) {
                    const rollbackResults = await Promise.allSettled([
                        qrService.deleteQrPermanently(qrRecord.qr_id),
                        storageService.removeQrAssets(qrRecord.unique_token)
                    ]);
                    rollbackFailed = rollbackResults.some(result => result.status === "rejected");
                    for (const result of rollbackResults) {
                        if (result.status !== "rejected") continue;
                        errors.push({
                            line,
                            stage: "rollback",
                            qrId: qrRecord.qr_id,
                            message: importErrorMessage(result.reason)
                        });
                    }
                }
                errors.push(detail);

                resultsByLine.push({
                    line,
                    status: rollbackFailed ? "created_with_errors" : "failed",
                    ...(rollbackFailed && qrRecord ? { qrId: qrRecord.qr_id } : {}),
                    holder: values.fullName,
                    errors: [detail]
                });
            }
        }

        const failedCount = resultsByLine.filter(result => result.status === "failed").length;
        const warningCount = resultsByLine.filter(result => result.status === "created_with_errors").length;
        const partial = errors.length > 0;
        const success = createdCount > 0;
        const statusCode = !success ? 422 : partial ? 207 : 201;
        const message = !rows.length
            ? "Le fichier CSV ne contient aucune ligne à importer."
            : partial
                ? `Import partiel : ${createdCount} QR créés, ${failedCount} lignes échouées et ${warningCount} créations avec avertissement.`
                : `${createdCount} QR Codes importés avec succès.`;

        return res.status(statusCode).json({
            success,
            partial,
            message,
            count: createdCount,
            createdCount,
            completedCount,
            failedCount,
            warningCount,
            totalRows: rows.length,
            results: resultsByLine,
            errors
        });
    } catch (error) {
        console.error("Erreur lors de l'importation CSV :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de l'importation" });
    } finally {
        if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
};

exports.generateCardForExistingQr = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const qrId = Number(req.params.id);
        const planContext = await getPlanContextForUser(req);
        const requestedCardMessage = req.body.cardMessage;
        const requestedCardData = req.body.cardData;
        const requestedTemplateId = String(req.body.cardTemplateId || "").trim();
        const requestedTemplate = requestedTemplateId
            ? await resolveCardTemplate(orgId, requestedTemplateId, planContext)
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
        let resolvedCardTemplate = requestedTemplate;
        if (!requestedTemplateId) {
            const snapshotTemplate = resolveTemplateSnapshot(qrRecord.card_template_snapshot);
            if (snapshotTemplate) {
                assertCustomTemplateAccess(planContext, snapshotTemplate.sourceTemplateId);
                resolvedCardTemplate = snapshotTemplate;
            } else {
                resolvedCardTemplate = await resolveCardTemplate(orgId, fallbackTemplateId, planContext);
            }
        }
        if (!fallbackTemplateId || !resolvedCardTemplate) {
            return res.status(400).json({ success: false, message: "Modèle de carte invalide." });
        }

        await qrService.updateQr(qrId, {
            card_template_id: resolvedCardTemplate.sourceTemplateId,
            card_template_snapshot: createTemplateSnapshot(resolvedCardTemplate),
            card_generated_at: null,
            card_message: cardMessage || null,
            card_generation_status: "ON_DEMAND",
            card_generation_error: null,
            card_data: cardData
        });

        return res.status(201).json({
            success: true,
            message: "Carte prête à être générée à la demande",
            cardUrl: null,
            cardPdfUrl: cardDownloadUrlForId(qrRecord.qr_id)
        });
    } catch (error) {
        if (error.code === "PLAN_CAPABILITY_REQUIRED") {
            return res.status(403).json({
                success: false,
                message: error.message,
                plan: error.plan,
                planName: error.planName,
                upgradeRequired: true
            });
        }
        console.error("Erreur lors de la génération de la carte :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la génération de la carte" });
    }
};
