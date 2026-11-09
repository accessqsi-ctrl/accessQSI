const express = require("express");
const { getPaymentConfig } = require("../config/payment");
const { registrationFormsEnabled } = require("../config/features");

// Interrupteurs publics lus par le frontend pour afficher ou masquer des menus.
// Le serveur reste la seule source : le frontend n'a plus de variable à garder synchronisée.
const router = express.Router();

router.get("/features", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({
        success: true,
        features: {
            proPayments: getPaymentConfig().enabled,
            registrationForms: registrationFormsEnabled()
        }
    });
});

module.exports = router;
