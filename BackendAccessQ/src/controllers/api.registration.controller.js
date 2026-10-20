const registrationService = require("../services/registration.service");
const { resolveAccessToken } = require("../services/registration_access.service");
const { generateRegistrationPassPdf } = require("../services/registration_card.service");
const logger = require("../utils/logger");

const requestMeta = (req, operation) => ({
    operation,
    request_id: req.requestId,
    org_id: req.user?.org_id,
    user_id: req.user?.user_id,
    form_id: req.params?.id,
    registration_id: req.params?.registrationId
});

const handleError = (req, res, error, operation) => {
    const status = error.statusCode || 500;
    const code = error.code || "REGISTRATION_ERROR";
    const meta = { ...requestMeta(req, operation), status, code };

    if (status >= 500) logger.error("registration.request_failed", { ...meta, error });
    else logger.warn("registration.request_rejected", { ...meta, reason: error.message });

    return res.status(status).json({
        success: false,
        code: error.statusCode ? code : "REGISTRATION_ERROR",
        message: error.statusCode ? error.message : "Erreur serveur",
        requestId: req.requestId
    });
};

const accessToken = req => {
    const authorization = String(req.get?.("authorization") || "");
    return authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
};

const offerDto = offer => ({
    id: offer.registration_offer_id,
    name: offer.name,
    description: offer.description,
    capacity: offer.capacity,
    accessType: offer.access_type,
    usageLimit: offer.usage_limit,
    level: offer.level,
    validFrom: offer.valid_from,
    validUntil: offer.valid_until
});

const formDto = (form, includeConfiguration = false) => ({
    id: form.registration_form_id,
    publicSlug: form.public_slug,
    title: form.title,
    description: form.description,
    status: form.status,
    opensAt: form.opens_at,
    closesAt: form.closes_at,
    askPhone: form.ask_phone,
    phoneRequired: form.phone_required,
    publishedAt: form.published_at,
    event: form.event ? { id: form.event.event_id, title: form.event.title, description: form.event.description, schedules: form.event.EventSchedules } : undefined,
    offers: form.offers?.map(offer => ({
        ...offerDto(offer),
        ...(includeConfiguration ? { cardTemplateId: offer.card_template_id, cardMessage: offer.card_message } : {})
    })),
    registrationCount: form._count?.registrations,
    open: form.open
});

exports.listForms = async (req, res) => {
    try { return res.json({ success: true, forms: (await registrationService.listForms(req.user.org_id)).map(form => formDto(form, true)) }); }
    catch (error) { return handleError(req, res, error, "list_forms"); }
};

exports.getForm = async (req, res) => {
    try {
        const form = await registrationService.getForm(req.user.org_id, req.params.id);
        if (!form) return res.status(404).json({ success: false, message: "Formulaire introuvable." });
        return res.json({ success: true, form: formDto(form, true) });
    } catch (error) { return handleError(req, res, error, "get_form"); }
};

exports.createForm = async (req, res) => {
    try { return res.status(201).json({ success: true, form: formDto(await registrationService.createForm(req.user.org_id, req.body), true) }); }
    catch (error) { return handleError(req, res, error, "create_form"); }
};

exports.updateForm = async (req, res) => {
    try { return res.json({ success: true, form: formDto(await registrationService.updateForm(req.user.org_id, req.params.id, req.body), true) }); }
    catch (error) { return handleError(req, res, error, "update_form"); }
};

exports.setStatus = async (req, res) => {
    try { return res.json({ success: true, form: formDto(await registrationService.setFormStatus(req.user.org_id, req.params.id, String(req.body.status || "").toUpperCase()), true) }); }
    catch (error) { return handleError(req, res, error, "set_form_status"); }
};

exports.listRegistrations = async (req, res) => {
    try {
        const result = await registrationService.listRegistrations(req.user.org_id, req.params.id, req.query);
        return res.json({ success: true, registrations: result.items, pagination: result.pagination });
    } catch (error) { return handleError(req, res, error, "list_registrations"); }
};

exports.retryIssuance = async (req, res) => {
    try {
        await registrationService.reacquireCapacityAndEnqueue(req.user.org_id, req.params.registrationId, "ISSUE_PASS");
        return res.status(202).json({ success: true, message: "Reprise planifiée." });
    } catch (error) { return handleError(req, res, error, "retry_pass_issuance"); }
};

exports.retryEmail = async (req, res) => {
    try {
        await registrationService.reacquireCapacityAndEnqueue(req.user.org_id, req.params.registrationId, "SEND_PASS_EMAIL");
        return res.status(202).json({ success: true, message: "Email planifié." });
    } catch (error) { return handleError(req, res, error, "retry_pass_email"); }
};

exports.getPublicForm = async (req, res) => {
    try { return res.json({ success: true, form: formDto(await registrationService.publicForm(req.params.slug)) }); }
    catch (error) { return handleError(req, res, error, "get_public_form"); }
};

exports.submit = async (req, res) => {
    try {
        const result = await registrationService.submit(req.params.slug, req.body, req.get("idempotency-key"));
        return res.status(result.replayed ? 200 : 202).json({
            success: true,
            replayed: result.replayed,
            registration: registrationService.serializePublicRegistration(result.registration),
            accessToken: result.access.rawToken,
            accessExpiresAt: result.access.expiresAt
        });
    } catch (error) { return handleError(req, res, error, "submit_public_registration"); }
};

exports.status = async (req, res) => {
    try {
        const access = await resolveAccessToken(accessToken(req));
        if (!access) {
            logger.warn("registration.access_denied", { ...requestMeta(req, "get_registration_status"), status: 404, code: "ACCESS_LINK_INVALID" });
            return res.status(404).json({ success: false, code: "ACCESS_LINK_INVALID", message: "Lien invalide ou expiré.", requestId: req.requestId });
        }
        return res.json({ success: true, registration: registrationService.serializePublicRegistration(access.registration), event: { title: access.registration.event.title }, offer: { name: access.registration.offer.name } });
    } catch (error) { return handleError(req, res, error, "get_registration_status"); }
};

exports.download = async (req, res) => {
    try {
        const access = await resolveAccessToken(accessToken(req));
        if (!access) {
            logger.warn("registration.access_denied", { ...requestMeta(req, "download_pass"), status: 404, code: "ACCESS_LINK_INVALID" });
            return res.status(404).json({ success: false, code: "ACCESS_LINK_INVALID", message: "Lien invalide ou expiré.", requestId: req.requestId });
        }
        const buffer = await generateRegistrationPassPdf(access.registration);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=pass-accessq.pdf");
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        return res.status(200).send(buffer);
    } catch (error) {
        const status = error.code === "PASS_NOT_AVAILABLE" ? 409 : error.code === "CARD_TEMPLATE_NOT_FOUND" ? 422 : 500;
        const code = error.code || "PASS_RENDER_FAILED";
        const meta = { ...requestMeta(req, "download_pass"), status, code };
        if (status >= 500) logger.error("registration.pass_download_failed", { ...meta, error });
        else logger.warn("registration.pass_download_rejected", { ...meta, reason: error.message });
        return res.status(status).json({ success: false, code: status === 500 ? "PASS_RENDER_FAILED" : code, message: status === 500 ? "Impossible de générer le pass." : error.message, requestId: req.requestId });
    }
};

exports.recover = async (req, res) => {
    const generic = { success: true, message: "Si des pass correspondent, de nouveaux liens seront envoyés." };
    try {
        await registrationService.queueRecovery(req.body?.email, req.body?.formSlug);
    } catch (error) {
        // Réponse volontairement identique pour empêcher l’énumération.
        logger.error("registration.recovery_queue_failed", { ...requestMeta(req, "recover_access"), error });
    }
    return res.status(202).json(generic);
};
