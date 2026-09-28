const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizePhone = (phone = "") => phone.replace(/[^\d+]/g, "");

export const formatInternationalPhone = (value = "") => {
    let cleaned = value.replace(/[^\d+]/g, "");

    if (cleaned.startsWith("00")) {
        cleaned = `+${cleaned.slice(2)}`;
    }

    cleaned = `${cleaned.startsWith("+") ? "+" : ""}${cleaned.replace(/\+/g, "")}`;

    if (cleaned && !cleaned.startsWith("+")) {
        cleaned = `+${cleaned}`;
    }

    const digits = cleaned.replace(/\D/g, "").slice(0, 15);
    if (!digits) return cleaned.startsWith("+") ? "+" : "";

    const groups = digits.match(/.{1,3}/g) || [];
    return `+${groups.join(" ")}`;
};

export const validateQrContact = ({ email = "", phone = "" }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    const errors = {};

    if (normalizedEmail && !emailPattern.test(normalizedEmail)) {
        errors.email = "Entrez une adresse email valide, par exemple nom@domaine.com.";
    }

    if (normalizedPhone && (!normalizedPhone.startsWith("+") || phoneDigits.length < 8 || phoneDigits.length > 15)) {
        errors.phone = "Entrez le numéro au format international, par exemple +243 812 345 678.";
    }

    return errors;
};

export const selectTemplateForExistingQr = (qr, templates = [], fallbackTemplateId = "") => {
    const availableIds = new Set(templates.map(template => template.templateId));
    if (qr?.cardTemplateId && availableIds.has(qr.cardTemplateId)) return qr.cardTemplateId;
    if (fallbackTemplateId && availableIds.has(fallbackTemplateId)) return fallbackTemplateId;
    return templates[0]?.templateId || "";
};
