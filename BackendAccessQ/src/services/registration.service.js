const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const { enqueue } = require("./registration_job.service");
const { createAccessToken } = require("./registration_access.service");
const { requestHashFor, resolveCardTemplate, createTemplateSnapshot } = require("./pass_issuance.service");
const { getOrganizationPlanContext } = require("../utils/planAccess");
const { assertRegistrationConfigurationAllowed } = require("./registration_plan.service");

class RegistrationError extends Error {
    constructor(message, code, statusCode = 400) {
        super(message);
        this.name = "RegistrationError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value, max) => String(value || "").trim().slice(0, max);
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const publicSlug = () => crypto.randomBytes(12).toString("base64url").toLowerCase();

const validateDates = (opensAt, closesAt) => {
    const opens = opensAt ? new Date(opensAt) : null;
    const closes = closesAt ? new Date(closesAt) : null;
    if ((opens && Number.isNaN(opens.getTime())) || (closes && Number.isNaN(closes.getTime()))) {
        throw new RegistrationError("Période d’inscription invalide.", "INVALID_REGISTRATION_PERIOD", 422);
    }
    if (opens && closes && opens >= closes) {
        throw new RegistrationError("La fermeture doit suivre l’ouverture.", "INVALID_REGISTRATION_PERIOD", 422);
    }
    return { opens, closes };
};

const normalizeOffer = offer => {
    const name = clean(offer?.name, 120);
    const capacity = offer?.capacity === "" || offer?.capacity == null ? null : Number(offer.capacity);
    const usageLimit = Number(offer?.usageLimit || offer?.usage_limit || 1);
    const level = Number(offer?.level || 1);
    const accessType = offer?.accessType === "unlimited" ? "unlimited" : offer?.accessType === "multi" ? "multi" : "single";
    const validFrom = offer?.validFrom ? new Date(offer.validFrom) : null;
    const validUntil = offer?.validUntil ? new Date(offer.validUntil) : null;
    if (!name) throw new RegistrationError("Le nom de chaque offre est requis.", "INVALID_OFFER", 422);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) throw new RegistrationError("Capacité invalide.", "INVALID_OFFER", 422);
    if (!Number.isInteger(usageLimit) || usageLimit < 1 || !Number.isInteger(level) || level < 1) throw new RegistrationError("Droits d’accès invalides.", "INVALID_OFFER", 422);
    if ((validFrom && Number.isNaN(validFrom.getTime())) || (validUntil && Number.isNaN(validUntil.getTime())) || (validFrom && validUntil && validFrom >= validUntil)) {
        throw new RegistrationError("Validité de l’offre invalide.", "INVALID_OFFER", 422);
    }
    return {
        registration_offer_id: uuidPattern.test(String(offer?.id || offer?.registration_offer_id || ""))
            ? String(offer.id || offer.registration_offer_id)
            : undefined,
        name,
        description: clean(offer?.description, 1000) || null,
        position: Number.isInteger(Number(offer?.position)) ? Number(offer.position) : 0,
        is_active: offer?.isActive !== false,
        capacity,
        access_type: accessType,
        usage_limit: accessType === "single" ? 1 : usageLimit,
        level,
        valid_from: validFrom,
        valid_until: validUntil,
        card_template_id: clean(offer?.cardTemplateId || offer?.card_template_id, 160) || null,
        card_message: clean(offer?.cardMessage || offer?.card_message, 240) || null
    };
};

const validateTemplates = async (orgId, offers) => {
    const plan = await getOrganizationPlanContext(orgId);
    assertRegistrationConfigurationAllowed(plan, offers);
    for (const offer of offers) {
        if (!offer.card_template_id) continue;
        const template = await resolveCardTemplate(orgId, offer.card_template_id, plan);
        if (!template) throw new RegistrationError("Un modèle de pass est introuvable.", "INVALID_CARD_TEMPLATE", 422);
    }
};

const formInclude = {
    event: { include: { EventSchedules: { include: { area: true }, orderBy: { start_date: "asc" } } } },
    offers: { orderBy: [{ position: "asc" }, { created_at: "asc" }] },
    _count: { select: { registrations: true } }
};

const listForms = orgId => prisma.registrationForm.findMany({ where: { org_id: orgId }, include: formInclude, orderBy: { created_at: "desc" } });
const getForm = (orgId, id) => prisma.registrationForm.findFirst({ where: { registration_form_id: id, org_id: orgId }, include: formInclude });

const createForm = async (orgId, input) => {
    const eventId = Number(input.eventId);
    const event = await prisma.event.findFirst({ where: { event_id: eventId, org_id: orgId, deleted_at: null } });
    if (!event) throw new RegistrationError("Événement introuvable.", "EVENT_NOT_FOUND", 404);
    const title = clean(input.title, 160);
    if (!title) throw new RegistrationError("Le titre est requis.", "INVALID_FORM", 422);
    const dates = validateDates(input.opensAt, input.closesAt);
    const offers = Array.isArray(input.offers) ? input.offers.map(normalizeOffer) : [];
    if (!offers.length) throw new RegistrationError("Ajoutez au moins une offre gratuite.", "INVALID_FORM", 422);
    await validateTemplates(orgId, offers);
    return prisma.registrationForm.create({
        data: {
            org_id: orgId,
            event_id: eventId,
            public_slug: publicSlug(),
            title,
            description: clean(input.description, 3000) || null,
            opens_at: dates.opens,
            closes_at: dates.closes,
            ask_phone: Boolean(input.askPhone || input.phoneRequired),
            phone_required: Boolean(input.phoneRequired),
            offers: { create: offers.map(({ registration_offer_id, ...offer }) => offer) }
        },
        include: formInclude
    });
};

const updateForm = async (orgId, id, input) => {
    const current = await getForm(orgId, id);
    if (!current) throw new RegistrationError("Formulaire introuvable.", "FORM_NOT_FOUND", 404);
    const dates = validateDates(input.opensAt, input.closesAt);
    const offers = Array.isArray(input.offers) ? input.offers.map(normalizeOffer) : null;
    if (offers && !offers.length) throw new RegistrationError("Ajoutez au moins une offre gratuite.", "INVALID_FORM", 422);
    if (offers) await validateTemplates(orgId, offers);
    return prisma.$transaction(async tx => {
        await tx.registrationForm.update({ where: { registration_form_id: id }, data: {
            title: clean(input.title, 160) || current.title,
            description: clean(input.description, 3000) || null,
            opens_at: dates.opens,
            closes_at: dates.closes,
            ask_phone: Boolean(input.askPhone || input.phoneRequired),
            phone_required: Boolean(input.phoneRequired)
        } });
        if (offers) {
            const currentOffers = await tx.registrationOffer.findMany({ where: { registration_form_id: id } });
            const currentIds = new Set(currentOffers.map(offer => offer.registration_offer_id));
            const retainedIds = new Set();
            for (const normalized of offers) {
                const { registration_offer_id: offerId, ...data } = normalized;
                if (offerId) {
                    if (!currentIds.has(offerId)) throw new RegistrationError("Une offre ne dépend pas de ce formulaire.", "OFFER_NOT_FOUND", 404);
                    const held = await tx.registration.count({ where: { registration_offer_id: offerId, capacity_held: true } });
                    if (data.capacity !== null && data.capacity < held) {
                        throw new RegistrationError(`La capacité ne peut pas être inférieure aux ${held} place(s) déjà attribuée(s).`, "CAPACITY_BELOW_USAGE", 409);
                    }
                    await tx.registrationOffer.update({ where: { registration_offer_id: offerId }, data });
                    retainedIds.add(offerId);
                } else {
                    const created = await tx.registrationOffer.create({ data: { ...data, registration_form_id: id } });
                    retainedIds.add(created.registration_offer_id);
                }
            }
            for (const previous of currentOffers.filter(offer => !retainedIds.has(offer.registration_offer_id))) {
                const used = await tx.registration.count({ where: { registration_offer_id: previous.registration_offer_id } });
                if (used > 0) {
                    await tx.registrationOffer.update({ where: { registration_offer_id: previous.registration_offer_id }, data: { is_active: false } });
                } else {
                    await tx.registrationOffer.delete({ where: { registration_offer_id: previous.registration_offer_id } });
                }
            }
        }
        return tx.registrationForm.findUnique({ where: { registration_form_id: id }, include: formInclude });
    });
};

const setFormStatus = async (orgId, id, status) => {
    const form = await getForm(orgId, id);
    if (!form) throw new RegistrationError("Formulaire introuvable.", "FORM_NOT_FOUND", 404);
    if (!["PUBLISHED", "CLOSED"].includes(status)) throw new RegistrationError("Statut invalide.", "INVALID_FORM_STATUS", 422);
    if (status === "PUBLISHED" && !form.offers.some(offer => offer.is_active)) throw new RegistrationError("Une offre active est requise.", "INVALID_FORM", 422);
    return prisma.registrationForm.update({
        where: { registration_form_id: id },
        data: status === "PUBLISHED"
            ? { status, published_at: form.published_at || new Date(), closed_at: null }
            : { status, closed_at: new Date() },
        include: formInclude
    });
};

const publicForm = async slug => {
    const form = await prisma.registrationForm.findUnique({
        where: { public_slug: clean(slug, 80) },
        include: formInclude
    });
    if (!form) throw new RegistrationError("Formulaire introuvable.", "FORM_NOT_FOUND", 404);
    const now = new Date();
    const open = form.status === "PUBLISHED" && (!form.opens_at || form.opens_at <= now) && (!form.closes_at || form.closes_at > now);
    return { ...form, open, offers: form.offers.filter(offer => offer.is_active) };
};

const snapshotOffer = async (offer, orgId) => {
    let templateSnapshot = null;
    if (offer.card_template_id) {
        const plan = await getOrganizationPlanContext(orgId);
        const resolved = await resolveCardTemplate(orgId, offer.card_template_id, plan);
        if (!resolved) throw new RegistrationError("Le modèle de cette offre n’est plus disponible.", "INVALID_CARD_TEMPLATE", 409);
        templateSnapshot = createTemplateSnapshot(resolved);
    }
    return {
        schemaVersion: 1,
        name: offer.name,
        description: offer.description,
        accessType: offer.access_type,
        usageLimit: offer.usage_limit,
        level: offer.level,
        validFrom: offer.valid_from,
        validUntil: offer.valid_until,
        cardTemplateId: offer.card_template_id,
        cardTemplateSnapshot: templateSnapshot,
        cardMessage: offer.card_message
    };
};

const serializePublicRegistration = registration => ({
    registrationId: registration.registration_id,
    status: registration.status,
    issuanceStatus: registration.issuance_status,
    emailStatus: registration.email_status,
    failureCode: registration.failure_code,
    failureMessage: registration.failure_message,
    passAvailable: Boolean(registration.qr_id && registration.issuance_status === "SUCCEEDED")
});

const submit = async (slug, input, submissionKey) => {
    const key = clean(submissionKey, 500);
    if (!key) throw new RegistrationError("Une clé Idempotency-Key est requise.", "IDEMPOTENCY_KEY_REQUIRED", 400);
    const name = clean(input.fullName, 160);
    const email = clean(input.email, 320).toLowerCase();
    const phone = clean(input.phone, 40) || null;
    const offerId = clean(input.offerId, 50);
    if (!name || !emailPattern.test(email)) throw new RegistrationError("Nom et email valide requis.", "INVALID_PARTICIPANT", 422);
    if (!uuidPattern.test(offerId)) throw new RegistrationError("Offre invalide.", "OFFER_NOT_FOUND", 404);
    const keyHash = sha256(key);
    const requestHash = requestHashFor({ name, email, phone, offerId });

    const existing = await prisma.registration.findFirst({ where: { form: { public_slug: clean(slug, 80) }, submission_key_hash: keyHash } });
    if (existing) {
        if (existing.request_hash !== requestHash) throw new RegistrationError("Cette soumission a déjà été utilisée avec d’autres données.", "IDEMPOTENCY_KEY_CONFLICT", 409);
        const access = await createAccessToken(existing.registration_id);
        return { registration: existing, access, replayed: true };
    }

    const run = () => prisma.$transaction(async tx => {
        const formRows = await tx.$queryRaw(Prisma.sql`SELECT registration_form_id FROM registration_forms WHERE public_slug = ${clean(slug, 80)} FOR UPDATE`);
        if (!formRows.length) throw new RegistrationError("Formulaire introuvable.", "FORM_NOT_FOUND", 404);
        const form = await tx.registrationForm.findUnique({ where: { registration_form_id: formRows[0].registration_form_id } });
        const now = new Date();
        if (form.status !== "PUBLISHED" || (form.opens_at && form.opens_at > now) || (form.closes_at && form.closes_at <= now)) {
            throw new RegistrationError("Ce formulaire n’accepte pas d’inscription.", "FORM_CLOSED", 409);
        }
        if (form.phone_required && !phone) throw new RegistrationError("Le téléphone est requis.", "INVALID_PARTICIPANT", 422);
        const offerRows = await tx.$queryRaw(Prisma.sql`SELECT registration_offer_id FROM registration_offers WHERE registration_offer_id = ${offerId}::uuid AND registration_form_id = ${form.registration_form_id}::uuid FOR UPDATE`);
        if (!offerRows.length) throw new RegistrationError("Offre invalide.", "OFFER_NOT_FOUND", 404);
        const offer = await tx.registrationOffer.findUnique({ where: { registration_offer_id: offerId } });
        if (!offer.is_active) throw new RegistrationError("Cette offre n’est plus disponible.", "OFFER_CLOSED", 409);
        if (offer.capacity !== null) {
            const held = await tx.registration.count({ where: { registration_offer_id: offerId, capacity_held: true } });
            if (held >= offer.capacity) throw new RegistrationError("Cette offre est complète.", "OFFER_SOLD_OUT", 409);
        }
        const duplicate = await tx.registration.findUnique({ where: { registration_form_id_submission_key_hash: { registration_form_id: form.registration_form_id, submission_key_hash: keyHash } } });
        if (duplicate) {
            if (duplicate.request_hash !== requestHash) throw new RegistrationError("Cette soumission a déjà été utilisée avec d’autres données.", "IDEMPOTENCY_KEY_CONFLICT", 409);
            const access = await createAccessToken(duplicate.registration_id, {}, tx);
            return { registration: duplicate, access, replayed: true };
        }
        const offerSnapshot = await snapshotOffer(offer, form.org_id);
        const registration = await tx.registration.create({ data: {
            org_id: form.org_id,
            event_id: form.event_id,
            registration_form_id: form.registration_form_id,
            registration_offer_id: offer.registration_offer_id,
            submission_key_hash: keyHash,
            request_hash: requestHash,
            holder_name: name,
            holder_email: email,
            holder_phone: phone,
            offer_snapshot: offerSnapshot
        } });
        await enqueue(registration.registration_id, "ISSUE_PASS", tx);
        const access = await createAccessToken(registration.registration_id, {}, tx);
        return { registration, access, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            return await run();
        } catch (error) {
            if (error?.code !== "P2034" || attempt === 3) throw error;
        }
    }
};

const listRegistrations = async (orgId, formId, query = {}) => {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where = { org_id: orgId, ...(formId ? { registration_form_id: formId } : {}) };
    if (query.status) where.status = query.status;
    if (query.search) where.OR = [
        { holder_name: { contains: clean(query.search, 100), mode: "insensitive" } },
        { holder_email: { contains: clean(query.search, 100), mode: "insensitive" } }
    ];
    const [items, total] = await Promise.all([
        prisma.registration.findMany({ where, include: { form: true, offer: true, qr_code: true, jobs: { orderBy: { created_at: "desc" }, take: 3 }, email_deliveries: { orderBy: { created_at: "desc" }, take: 3 } }, orderBy: { created_at: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.registration.count({ where })
    ]);
    return { items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
};

const queueRecovery = async (emailValue, formSlug) => {
    const email = clean(emailValue, 320).toLowerCase();
    const slug = clean(formSlug, 80);
    if (!emailPattern.test(email) || !slug) return 0;
    const matches = await prisma.registration.findMany({
        where: {
            holder_email: { equals: email, mode: "insensitive" },
            form: { public_slug: slug },
            issuance_status: "SUCCEEDED"
        },
        select: { registration_id: true }
    });
    for (const registration of matches) {
        await enqueue(registration.registration_id, "SEND_PASS_EMAIL");
    }
    return matches.length;
};

const reacquireCapacityAndEnqueue = async (orgId, registrationId, type) => prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw(Prisma.sql`SELECT registration_id FROM registrations WHERE registration_id = ${registrationId}::uuid FOR UPDATE`);
    if (!rows.length) throw new RegistrationError("Inscription introuvable.", "REGISTRATION_NOT_FOUND", 404);
    const registration = await tx.registration.findFirst({ where: { registration_id: registrationId, org_id: orgId }, include: { offer: true } });
    if (!registration) throw new RegistrationError("Inscription introuvable.", "REGISTRATION_NOT_FOUND", 404);
    if (type === "ISSUE_PASS" && registration.issuance_status !== "SUCCEEDED") {
        await tx.$queryRaw(Prisma.sql`SELECT registration_offer_id FROM registration_offers WHERE registration_offer_id = ${registration.registration_offer_id}::uuid FOR UPDATE`);
        if (!registration.capacity_held && registration.offer.capacity !== null) {
            const held = await tx.registration.count({ where: { registration_offer_id: registration.registration_offer_id, capacity_held: true } });
            if (held >= registration.offer.capacity) throw new RegistrationError("La capacité est désormais atteinte.", "OFFER_SOLD_OUT", 409);
        }
        await tx.registration.update({ where: { registration_id: registrationId }, data: { status: "PROCESSING", issuance_status: "PENDING", capacity_held: true, capacity_released_at: null, failure_code: null, failure_message: null } });
    }
    if (type === "SEND_PASS_EMAIL" && registration.issuance_status !== "SUCCEEDED") throw new RegistrationError("Le pass n’est pas encore disponible.", "PASS_NOT_AVAILABLE", 409);
    const job = await enqueue(registrationId, type, tx);
    if (type === "SEND_PASS_EMAIL") await tx.registration.update({ where: { registration_id: registrationId }, data: { email_status: "PENDING" } });
    return job;
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

module.exports = { RegistrationError, createForm, getForm, listForms, listRegistrations, publicForm, queueRecovery, reacquireCapacityAndEnqueue, serializePublicRegistration, setFormStatus, submit, updateForm };
