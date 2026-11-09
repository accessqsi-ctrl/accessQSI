const { registrationFormsEnabled } = require("../config/features");

// Fonctionnalité désactivée : la route répond comme si elle n'existait pas.
const requireRegistrationForms = (req, res, next) => {
    if (registrationFormsEnabled()) return next();
    return res.status(404).json({ success: false, code: "FEATURE_DISABLED", message: "Ressource introuvable." });
};

module.exports = { requireRegistrationForms };
