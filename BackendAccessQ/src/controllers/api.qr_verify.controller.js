const qrVerifyService = require("../services/qr_verify.service");
const logger = require("../utils/logger");

exports.verifyScan = async (req, res) => {
    try {
        const { token, location, areaId, eventId } = req.body;
        const scannerId = req.user.user_id;
        const scannerOrgId = req.user.org_id;

        if (!token) {
            return res.status(400).json({ success: false, message: "Token manquant." });
        }

        const selectedEventId = Number(eventId);
        if (!Number.isInteger(selectedEventId) || selectedEventId <= 0) {
            return res.status(400).json({ success: false, message: "Sélectionnez l'événement à contrôler." });
        }

        const selectedAreaId = Number(areaId);
        if (!Number.isInteger(selectedAreaId) || selectedAreaId <= 0) {
            return res.status(400).json({ success: false, message: "Sélectionnez la zone de contrôle." });
        }

        const scanLocation = {};
        const latitude = Number(location?.latitude);
        const longitude = Number(location?.longitude);
        if (
            Number.isFinite(latitude) && Number.isFinite(longitude)
            && latitude >= -90 && latitude <= 90
            && longitude >= -180 && longitude <= 180
        ) {
            scanLocation.latitude = latitude;
            scanLocation.longitude = longitude;
        }

        const { qr, decision } = await qrVerifyService.verifyAndRecordScan({
            token,
            scannerId,
            scannerOrgId,
            areaId: selectedAreaId,
            eventId: selectedEventId,
            location: scanLocation
        });

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

        if (decision.success) {
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
