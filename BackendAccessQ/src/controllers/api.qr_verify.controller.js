const qrVerifyService = require("../services/qr_verify.service");

exports.verifyScan = async (req, res) => {
    try {
        const { token } = req.body;
        const scannerId = req.user.user_id;
        const scannerOrgId = req.user.org_id;

        if (!token) {
            return res.status(400).json({ success: false, message: "Token manquant." });
        }

        const qr = await qrVerifyService.getQrByToken(token);

        if (!qr) {
            return res.status(404).json({ success: false, message: "QR Code non reconnu ou inexistant." });
        }

        // 1. Vérification de sécurité : correspondance de l'organisation
        if (qr.event.org_id !== scannerOrgId) {
            return res.status(403).json({ success: false, message: "Ce QR Code n'appartient pas à votre organisation." });
        }

        // 2. Vérifications logiques
        let scanStatus = "authorized";
        let denialReason = "";

        const now = new Date();

        if (qr.status === "revoked") {
            scanStatus = "denied_revoked";
            denialReason = "Ce QR Code a été révoqué par un administrateur.";
        } else if (qr.usage_limit > 0 && qr.scans_count >= qr.usage_limit) {
            scanStatus = "denied_limit_reached";
            denialReason = "Limite d'utilisation atteinte.";
        } else if (qr.valid_from && now < new Date(qr.valid_from)) {
            scanStatus = "denied_expired"; // Pas encore valide
            denialReason = `Valide à partir de : ${new Date(qr.valid_from).toLocaleString()}`;
        } else if (qr.valid_until && now > new Date(qr.valid_until)) {
            scanStatus = "denied_expired";
            denialReason = "Ce QR Code est expiré.";
        }

        // 3. Enregistrer le scan
        await qrVerifyService.recordScan(qr.qr_id, scannerId, scanStatus);

        // 4. Répondre
        if (scanStatus === "authorized") {
            // Vérifier si la limite est atteinte maintenant pour mettre à jour le statut (optionnel mais propre)
            if (qr.usage_limit > 0 && (qr.scans_count + 1) >= qr.usage_limit) {
                await qrVerifyService.updateQrStatus(qr.qr_id, "used_up");
            }

            return res.status(200).json({
                success: true,
                message: "Accès Autorisé",
                holder: {
                    name: qr.holder_name || "Invité Anonyme",
                    email: qr.holder_email,
                    level: qr.level
                },
                remaining: qr.usage_limit > 0 ? (qr.usage_limit - (qr.scans_count + 1)) : "Illimité"
            });
        } else {
            return res.status(200).json({ // On retourne 200 success:false pour un traitement d'erreur convivial côté UI
                success: false,
                message: "Accès Refusé",
                reason: denialReason
            });
        }

    } catch (error) {
        console.error("Erreur verifyScan:", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la vérification." });
    }
};
