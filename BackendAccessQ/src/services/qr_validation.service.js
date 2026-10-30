const { PERIOD_UNITS, resolveTimeZone, zonedDateTime } = require("./qr_period.service");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCESS_TYPES = new Set(["single", "multi", "unlimited"]);

// Dates sans fuseau (import CSV : « 2026-11-02 08:00 », « 02/11/2026 08:00 ») : heure locale de
// l'administrateur, et non celle du serveur. Une date seule vaut minuit, ou la fin du jour pour une date de fin.
// Les dates avec fuseau (ISO « Z » ou « +01:00 » envoyées par l'interface) sont lues telles quelles.
const NAIVE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const NAIVE_FR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const toOptionalDate = (value, timeZone, { endOfDay = false } = {}) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const text = String(value).trim();
    const iso = text.match(NAIVE_ISO_DATE);
    const fr = text.match(NAIVE_FR_DATE);
    if (!iso && !fr) return new Date(text);
    const [year, month, day] = (iso ? [iso[1], iso[2], iso[3]] : [fr[3], fr[2], fr[1]]).map(Number);
    const [hour, minute, second] = (iso || fr).slice(4, 7).map(part => Number(part || 0));
    const hasTime = (iso || fr)[4] !== undefined;
    // Refuse les dates impossibles (31/02, 25:00) au lieu de les reporter sur le jour suivant.
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
        return new Date(NaN);
    }
    if (!hasTime && endOfDay) return new Date(zonedDateTime(year, month, day + 1, 0, 0, 0, timeZone).getTime() - 1);
    return zonedDateTime(year, month, day, hour, minute, second, timeZone);
};

// Keep the complete holder name while normalizing whitespace pasted from
// spreadsheets, phones or rich-text sources (including non-breaking spaces).
const normalizeHolderName = (value) => String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();

const validateQrPayload = (input = {}, { line = null } = {}) => {
    const rawFullName = input.fullName ?? input.holderName ?? input.holder_name ?? input.name ?? input.nom ?? "";
    const fullName = normalizeHolderName(rawFullName);
    const email = String(input.email || "").trim().toLowerCase() || null;
    const phone = String(input.phone || input.telephone || "").trim() || null;
    const accessType = String(input.accessType || "single").trim().toLowerCase();
    const limit = input.limit === undefined || input.limit === "" ? (accessType === "multi" ? 2 : 1) : Number(input.limit);
    const level = input.level === undefined || input.level === "" ? 1 : Number(input.level);
    const inputTimeZone = resolveTimeZone(String(input.periodTimezone || "").trim());
    const validFrom = toOptionalDate(input.validFrom, inputTimeZone);
    const validUntil = toOptionalDate(input.validUntil, inputTimeZone, { endOfDay: true });
    const cardTemplateId = String(input.cardTemplateId || input.card_template_id || input.templateId || "").trim();
    const cardMessage = String(input.cardMessage || input.card_message || "").trim().slice(0, 160);
    const periodUnit = String(input.periodUnit ?? input.period_unit ?? "").trim().toLowerCase() || null;
    const rawPeriodLimit = input.periodLimit ?? input.period_limit;
    const periodLimit = periodUnit
        ? (rawPeriodLimit === undefined || rawPeriodLimit === "" ? 1 : Number(rawPeriodLimit))
        : null;
    const periodTimezone = periodUnit ? inputTimeZone : null;
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
    if (periodUnit && !PERIOD_UNITS.includes(periodUnit)) {
        addError("periodUnit", "La période doit être day, week ou month.");
    }
    if (periodUnit && (!Number.isInteger(periodLimit) || periodLimit < 1 || periodLimit > 1000)) {
        addError("periodLimit", "La limite par période doit être un entier compris entre 1 et 1 000.");
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
            cardMessage,
            periodLimit,
            periodUnit,
            periodTimezone
        }
    };
};

module.exports = { normalizeHolderName, validateQrPayload };
