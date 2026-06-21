const qrVerifyService = require("../services/qr_verify.service");
const { evaluateQrScan } = require("../services/qr_policy.service");
const logger = require("../utils/logger");

exports.verifyScan = async (req, res) => {
    try {
        const { token, location } = req.body;
        const scannerId = req.user.user_id;
        const scannerOrgId = req.user.org_id;

        if (!token) {
            return res.status(400).json({ success: false, message: "Token manquant." });
        }

        const qr = await qrVerifyService.getQrByToken(token);

        const decision = evaluateQrScan(qr, scannerOrgId);

        if (!decision.shouldRecord) {
            logger.warn("qr.scan_rejected", {
                request_id: req.requestId,
                scanner_id: scannerId,
                org_id: scannerOrgId,
                http_status: decision.httpStatus,
                message: decision.message
            });
            return res.status(decision.httpStatus).json({
                success: decision.success,
                message: decision.message
            });
        }

        const scanLocation = {};
        if (location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))) {
            scanLocation.latitude = Number(location.latitude);
            scanLocation.longitude = Number(location.longitude);
        }

        // 3. Enregistrer le scan
        await qrVerifyService.recordScan(qr.qr_id, scannerId, decision.scanStatus, scanLocation);

        // 4. Répondre
        if (decision.success) {
            // Vérifier si la limite est atteinte maintenant pour mettre à jour le statut (optionnel mais propre)
            if (decision.shouldMarkUsedUp) {
                await qrVerifyService.updateQrStatus(qr.qr_id, "used_up");
            }

            logger.info("qr.scan_authorized", {
                request_id: req.requestId,
                scanner_id: scannerId,
                org_id: scannerOrgId,
                qr_id: qr.qr_id,
                event_id: qr.event_id,
                remaining: decision.remaining
            });

            return res.status(200).json({
                success: true,
                message: decision.message,
                holder: {
                    name: qr.holder_name || "Invité Anonyme",
                    email: qr.holder_email,
                    level: qr.level
                },
                remaining: decision.remaining
            });
        } else {
            logger.warn("qr.scan_denied", {
                request_id: req.requestId,
                scanner_id: scannerId,
                org_id: scannerOrgId,
                qr_id: qr.qr_id,
                event_id: qr.event_id,
                scan_status: decision.scanStatus,
                reason: decision.reason
            });

            return res.status(200).json({ // On retourne 200 success:false pour un traitement d'erreur convivial côté UI
                success: false,
                message: decision.message,
                reason: decision.reason
            });
        }

    } catch (error) {
        console.error("Erreur verifyScan:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la vérification." });
    }
};
