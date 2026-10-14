const QRCode = require("qrcode");
const cardTemplateService = require("./card_template.service");

const buildQrPayload = qr => JSON.stringify({ t: qr.unique_token, e: qr.event_id });

const resolveSnapshot = qr => {
    const snapshot = qr.card_template_snapshot;
    if (snapshot?.schemaVersion === 1 && snapshot.baseTemplateId) {
        return { templateId: snapshot.baseTemplateId, customization: snapshot.customization || undefined };
    }
    const templateId = qr.card_template_id || "event-ticket";
    if (!cardTemplateService.hasTemplate(templateId)) {
        const error = new Error("Le modèle associé à ce pass est introuvable.");
        error.code = "CARD_TEMPLATE_NOT_FOUND";
        throw error;
    }
    return { templateId };
};

const generateRegistrationPassPdf = async registration => {
    if (!registration?.qr_code || registration.issuance_status !== "SUCCEEDED") {
        const error = new Error("Le pass n’est pas encore disponible.");
        error.code = "PASS_NOT_AVAILABLE";
        throw error;
    }
    const qr = registration.qr_code;
    const resolved = resolveSnapshot(qr);
    const image = await QRCode.toBuffer(buildQrPayload(qr), { errorCorrectionLevel: "H", margin: 2, width: 400 });
    return cardTemplateService.generateCardsPdfBuffer([{
        ...resolved,
        event: registration.event,
        qrRecord: qr,
        qrUrl: `data:image/png;base64,${image.toString("base64")}`,
        cardMessage: qr.card_message,
        cardData: qr.card_data
    }]);
};

module.exports = { generateRegistrationPassPdf, resolveSnapshot };
