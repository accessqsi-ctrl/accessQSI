// Interrupteurs de fonctionnalités appliqués par le serveur. Masquer un menu côté frontend ne suffit pas.
const registrationFormsEnabled = (env = process.env) => String(env.REGISTRATION_FORMS_ENABLED || "").trim().toLowerCase() === "true";

module.exports = { registrationFormsEnabled };
