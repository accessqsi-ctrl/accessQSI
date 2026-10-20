const qrService = require("../services/qr.service");
const eventService = require("../services/event.service");
const qrPhotoService = require("../services/qr_photo.service");
const logger = require("../utils/logger");

// Vérifie que le QR existe et appartient à un événement de l'organisation de l'utilisateur.
const findOwnedQr = async (req, res) => {
    const qrId = Number(req.params.id);
    if (!Number.isInteger(qrId) || qrId <= 0) {
        res.status(400).json({ success: false, message: "Identifiant du QR invalide." });
        return null;
    }
    const qr = await qrService.getQrById(qrId);
    if (!qr || qr.deleted_at) {
        res.status(404).json({ success: false, message: "QR Code introuvable" });
        return null;
    }
    const event = await eventService.findById(req.user.org_id, qr.event_id);
    if (!event) {
        res.status(403).json({ success: false, message: "Accès refusé" });
        return null;
    }
    return qr;
};

exports.uploadHolderPhoto = async (req, res) => {
    try {
        const qr = await findOwnedQr(req, res);
        if (!qr) return;

        const buffer = req.file?.buffer;
        if (!buffer?.length) {
            return res.status(400).json({ success: false, message: "Photo requise." });
        }
        const mimeType = qrPhotoService.detectImageType(buffer);
        if (!mimeType) {
            return res.status(415).json({ success: false, message: "Format non supporté. Utilisez une image JPEG, PNG ou WebP." });
        }

        const saved = await qrPhotoService.savePhoto(qr.qr_id, buffer, mimeType);
        logger.info("qr.holder_photo_saved", {
            request_id: req.requestId,
            user_id: req.user.user_id,
            org_id: req.user.org_id,
            qr_id: qr.qr_id,
            bytes: buffer.length
        });
        return res.status(200).json({
            success: true,
            message: "Photo enregistrée.",
            hasPhoto: true,
            photoVersion: new Date(saved.updated_at).getTime()
        });
    } catch (error) {
        logger.error("qr.holder_photo_save_failed", { request_id: req.requestId, error });
        return res.status(500).json({ success: false, message: "Impossible d'enregistrer la photo." });
    }
};

exports.deleteHolderPhoto = async (req, res) => {
    try {
        const qr = await findOwnedQr(req, res);
        if (!qr) return;

        await qrPhotoService.deletePhoto(qr.qr_id);
        logger.info("qr.holder_photo_deleted", {
            request_id: req.requestId,
            user_id: req.user.user_id,
            org_id: req.user.org_id,
            qr_id: qr.qr_id
        });
        return res.status(200).json({ success: true, message: "Photo supprimée.", hasPhoto: false });
    } catch (error) {
        logger.error("qr.holder_photo_delete_failed", { request_id: req.requestId, error });
        return res.status(500).json({ success: false, message: "Impossible de supprimer la photo." });
    }
};

exports.getHolderPhoto = async (req, res) => {
    try {
        const qr = await findOwnedQr(req, res);
        if (!qr) return;

        const photo = await qrPhotoService.getPhoto(qr.qr_id);
        if (!photo) {
            return res.status(404).json({ success: false, message: "Aucune photo pour ce QR." });
        }
        res.setHeader("Content-Type", photo.mime_type);
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(200).send(Buffer.from(photo.data));
    } catch (error) {
        logger.error("qr.holder_photo_read_failed", { request_id: req.requestId, error });
        return res.status(500).json({ success: false, message: "Impossible de charger la photo." });
    }
};
