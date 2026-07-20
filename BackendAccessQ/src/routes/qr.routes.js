const express = require('express');
const router = express.Router();
const qrController = require("../controllers/api.qr.controller");
const qrVerifyController = require("../controllers/api.qr_verify.controller");
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const multer = require('multer');
const upload = multer({
    dest: 'tmp/uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Format de fichier non supporté. Veuillez envoyer un CSV.'), false);
        }
    }
});
router.use(authMiddleware);
const canScan = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN", "ORG_AGENT", "OPERATOR"]);
const adminOnly = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]);

// Vérification d'un QR code (Scanner)
router.post("/verify", canScan, qrVerifyController.verifyScan);

// Récupération de tous les QR codes 
router.get("/qrs", adminOnly, qrController.getAllQrs);

// Télécharger le modèle CSV pour importer des QR codes
router.get("/template/:event_id", adminOnly, qrController.downloadQrImportTemplate);

// Récupération des QR codes d'un événement spécifique
router.get("/event/:event_id", adminOnly, qrController.getQrsByEvent);

// Générer un QR code pour un événement spécifique
router.post("/generate/:event_id", adminOnly, qrController.generateQrForEvent);

// Générer une carte pour un QR existant
router.post("/card/:id", adminOnly, qrController.generateCardForExistingQr);

// Importer des QR codes depuis un CSV
router.post("/import/:event_id", adminOnly, upload.single('file'), qrController.importQrsFromCSV);

// Révoquer un QR code
router.put("/revoke/:id", adminOnly, qrController.revokeQr);

// Restaurer un QR code révoqué encore valide
router.put("/restore/:id", adminOnly, qrController.restoreQr);


// Note: Toutes les anciennes routes (/ajoutP, /updateP, /mytransactions) 
// qui semblaient concerner un autre projet ("produits") ont été supprimées 
// pour garder une API REST propre dédiée à accessQSI.


module.exports = router;
