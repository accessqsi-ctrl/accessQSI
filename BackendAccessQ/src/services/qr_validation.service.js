const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCESS_TYPES = new Set(["single", "multi", "unlimited"]);

const toOptionalDate = (value) => value ? new Date(value) : null;

const validateQrPayload = (input = {}, { line = null } = {}) => {
    const fullName = String(input.fullName || input.name || input.nom || "").trim();
    const email = String(input.email || "").trim().toLowerCase() || null;
    const phone = String(input.phone || input.telephone || "").trim() || null;
    const accessType = String(input.accessType || "single").trim().toLowerCase();
    const limit = input.limit === undefined || input.limit === "" ? (accessType === "multi" ? 2 : 1) : Number(input.limit);
    const level = input.level === undefined || input.level === "" ? 1 : Number(input.level);
    const validFrom = toOptionalDate(input.validFrom);
    const validUntil = toOptionalDate(input.validUntil);
    const cardTemplateId = String(input.cardTemplateId || input.card_template_id || input.templateId || "").trim();
    const cardMessage = String(input.cardMessage || input.card_message || "").trim().slice(0, 160);
    const errors = [];

    const addError = (field, message) => errors.push({
        ...(line === null ? {} : { line }),
        field,
        message
    });

    if (!fullName) addError("fullName", "Nom complet requis.");
    if (fullName.length > 120) addError("fullName", "Le nom complet ne peut pas dépasser 120 caractères.");
    if (!ACCESS_TYPES.has(accessType)) addError("accessType", "Type d’accès invalide.");
    if (accessType === "multi" && (!Number.isInteger(limit) || limit < 1 || limit > 1_000_000)) {
        addError("limit", "La limite doit être un entier compris entre 1 et 1 000 000.");
    }
    if (!Number.isInteger(level) || level < 1 || level > 100) {
        addError("level", "Le niveau doit être un entier compris entre 1 et 100.");
    }
    if (email && !EMAIL_PATTERN.test(email)) addError("email", "Adresse email invalide.");
    if (phone && phone.length > 30) addError("phone", "Le numéro de téléphone ne peut pas dépasser 30 caractères.");
    if (validFrom && Number.isNaN(validFrom.getTime())) addError("validFrom", "Date de début invalide.");
    if (validUntil && Number.isNaN(validUntil.getTime())) addError("validUntil", "Date de fin invalide.");
    if (
        validFrom && validUntil
        && !Number.isNaN(validFrom.getTime())
        && !Number.isNaN(validUntil.getTime())
        && validFrom > validUntil
    ) {
        addError("validUntil", "La date de fin doit être postérieure à la date de début.");
    }

    return {
        errors,
        values: {
            fullName,
            email,
            phone,
            accessType,
            limit,
            level,
            validFrom,
            validUntil,
            cardTemplateId,
            cardMessage
        }
    };
};

module.exports = { validateQrPayload };
