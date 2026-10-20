const crypto = require("crypto");
const eventService = require("./event.service");
const qrService = require("./qr.service");
const cardTemplateService = require("./card_template.service");
const customCardTemplateService = require("./custom_card_template.service");
const { validateQrPayload } = require("./qr_validation.service");
const { usageLimitFromAccessType } = require("./qr_status.service");
const { withEventQrQuota } = require("./organization_quota.service");
const { getOrganizationPlanContext } = require("../utils/planAccess");
const { PLAN_CAPABILITIES, hasPlanCapability } = require("../config/subscription");

class PassIssuanceError extends Error {
    constructor(message, code, options = {}) {
        super(message);
        this.name = "PassIssuanceError";
        this.code = code;
        this.statusCode = options.statusCode || 400;
        this.errors = options.errors || null;
        this.values = options.values || null;
    }
}

const isCustomTemplateId = (cardTemplateId) => Boolean(
    cardTemplateService.extractCustomTemplateId?.(cardTemplateId)
    || String(cardTemplateId || "").startsWith("custom:")
);

const assertCustomTemplateAccess = (planContext, cardTemplateId) => {
    if (
        isCustomTemplateId(cardTemplateId)
        && !hasPlanCapability(planContext, PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES)
    ) {
        const error = new PassIssuanceError(
            "Les modèles personnalisés nécessitent un abonnement Pro.",
            "PLAN_CAPABILITY_REQUIRED",
            { statusCode: 403 }
        );
        error.plan = planContext.plan;
        error.planName = planContext.planName;
        throw error;
    }
};

const resolveCardTemplate = async (organizationId, cardTemplateId, planContext) => {
    if (!cardTemplateId) return null;
    const standardAvailable = cardTemplateService.isTemplateAvailable
        ? cardTemplateService.isTemplateAvailable(cardTemplateId)
        : cardTemplateService.hasTemplate(cardTemplateId);
    if (standardAvailable) {
        return { sourceTemplateId: cardTemplateId, templateId: cardTemplateId };
    }

    assertCustomTemplateAccess(planContext, cardTemplateId);
    const customTemplate = await customCardTemplateService.resolveCustomForRender(
        organizationId,
        cardTemplateId
    );
    if (!customTemplate) return null;
    return {
        sourceTemplateId: cardTemplateId,
        templateId: customTemplate.baseTemplateId,
        customization: customTemplate
    };
};

const createTemplateSnapshot = (resolvedTemplate) => resolvedTemplate ? {
    schemaVersion: 1,
    sourceTemplateId: resolvedTemplate.sourceTemplateId,
    baseTemplateId: resolvedTemplate.templateId,
    customization: resolvedTemplate.customization || null
} : null;

const resolveTrustedTemplateSnapshot = snapshot => {
    if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.sourceTemplateId || !snapshot.baseTemplateId) return null;
    return {
        sourceTemplateId: String(snapshot.sourceTemplateId),
        templateId: String(snapshot.baseTemplateId),
        customization: snapshot.customization || undefined
    };
};

const normalizeCardData = (value = {}) => {
    const source = value && typeof value === "object" ? value : {};
    return {
        spouseOne: String(source.spouseOne || "").trim().slice(0, 80),
        spouseTwo: String(source.spouseTwo || "").trim().slice(0, 80),
        zone: String(source.zone || "").trim().slice(0, 80),
        address: String(source.address || "").trim().slice(0, 140)
    };
};

const stableValue = (value) => {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value).sort().map(key => [key, stableValue(value[key])])
        );
    }
    return value;
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const requestHashFor = (value) => sha256(JSON.stringify(stableValue(value)));

const normalizeIdempotency = (idempotency) => {
    if (!idempotency) return null;
    const scope = String(idempotency.scope || "").trim();
    const key = String(idempotency.key || "").trim();
    if (!scope || !key) {
        throw new PassIssuanceError(
            "La portée et la clé d’idempotence sont requises ensemble.",
            "INVALID_IDEMPOTENCY_KEY"
        );
    }
    if (scope.length > 120 || key.length > 500) {
        throw new PassIssuanceError(
            "La portée ou la clé d’idempotence est trop longue.",
            "INVALID_IDEMPOTENCY_KEY"
        );
    }
    return { scope, keyHash: sha256(key) };
};

const findIdempotentRecord = (orgId, idempotency, dbClient) => (
    qrService.findPassIssuanceRequest(
        orgId,
        idempotency.scope,
        idempotency.keyHash,
        dbClient
    )
);

const resolveIdempotentRecord = (existing, requestHash) => {
    if (!existing) return null;
    if (existing.request_hash !== requestHash) {
        throw new PassIssuanceError(
            "Cette clé d’idempotence a déjà été utilisée avec des paramètres différents.",
            "IDEMPOTENCY_KEY_CONFLICT",
            { statusCode: 409 }
        );
    }
    return existing.qr_code;
};

const issuePass = async ({
    organizationId,
    eventId,
    input = {},
    planContext = null,
    useOrganizationDefaultTemplate = false,
    trustedTemplateSnapshot = null,
    idempotency = null
}) => {
    const orgId = Number(organizationId);
    const normalizedEventId = Number(eventId);
    if (!Number.isInteger(orgId) || !Number.isInteger(normalizedEventId)) {
        throw new PassIssuanceError(
            "Organisation ou événement invalide.",
            "INVALID_ISSUANCE_CONTEXT"
        );
    }

    const validation = validateQrPayload(input);
    if (validation.errors.length > 0) {
        throw new PassIssuanceError("Données QR invalides.", "PASS_VALIDATION_FAILED", {
            statusCode: 422,
            errors: validation.errors,
            values: validation.values
        });
    }

    const event = await eventService.findById(orgId, normalizedEventId);
    if (!event) {
        throw new PassIssuanceError(
            "Événement non trouvé ou accès refusé",
            "EVENT_NOT_FOUND",
            { statusCode: 404 }
        );
    }

    const hasRequestedTemplate = Object.prototype.hasOwnProperty.call(input, "cardTemplateId")
        || Object.prototype.hasOwnProperty.call(input, "card_template_id")
        || Object.prototype.hasOwnProperty.call(input, "templateId");
    const normalizedIdempotency = normalizeIdempotency(idempotency);
    const requestHash = normalizedIdempotency ? requestHashFor({
        orgId,
        eventId: event.event_id,
        values: validation.values,
        cardData: normalizeCardData(input.cardData),
        templateSelection: trustedTemplateSnapshot
            ? { snapshot: stableValue(trustedTemplateSnapshot) }
            : hasRequestedTemplate
            ? { explicit: validation.values.cardTemplateId }
            : { organizationDefault: Boolean(useOrganizationDefaultTemplate) }
    }) : null;
    if (normalizedIdempotency) {
        const existing = await findIdempotentRecord(orgId, normalizedIdempotency);
        const existingQr = resolveIdempotentRecord(existing, requestHash);
        if (existingQr) return { qrRecord: existingQr, event, replayed: true };
    }

    const effectivePlanContext = planContext || await getOrganizationPlanContext(orgId);
    let cardTemplateId = hasRequestedTemplate
        ? validation.values.cardTemplateId
        : useOrganizationDefaultTemplate
            ? await customCardTemplateService.getDefaultForOrg(orgId)
            : "";

    if (!hasRequestedTemplate && isCustomTemplateId(cardTemplateId)) {
        const canUseCustomTemplates = hasPlanCapability(
            effectivePlanContext,
            PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES
        );
        if (!canUseCustomTemplates) cardTemplateId = "";
    }

    const snapshottedTemplate = resolveTrustedTemplateSnapshot(trustedTemplateSnapshot);
    if (trustedTemplateSnapshot && !snapshottedTemplate) {
        throw new PassIssuanceError("Snapshot de modèle invalide.", "INVALID_CARD_TEMPLATE");
    }
    if (snapshottedTemplate) cardTemplateId = snapshottedTemplate.sourceTemplateId;
    const resolvedCardTemplate = snapshottedTemplate || (cardTemplateId
        ? await resolveCardTemplate(orgId, cardTemplateId, effectivePlanContext)
        : null);
    if (cardTemplateId && !resolvedCardTemplate) {
        throw new PassIssuanceError(
            "Modèle de carte invalide.",
            "INVALID_CARD_TEMPLATE"
        );
    }

    const values = validation.values;
    const cardData = normalizeCardData(input.cardData);
    const qrData = {
        status: "active",
        usage_limit: usageLimitFromAccessType(values.accessType, values.limit),
        scans_count: 0,
        valid_from: values.validFrom,
        valid_until: values.validUntil,
        level: values.level,
        holder_name: values.fullName,
        holder_email: values.email || null,
        holder_phone: values.phone || null,
        card_data: cardTemplateId ? cardData : undefined,
        card_template_id: cardTemplateId || null,
        card_template_snapshot: createTemplateSnapshot(resolvedCardTemplate),
        card_generated_at: null,
        card_message: cardTemplateId ? values.cardMessage || null : null,
        card_generation_status: cardTemplateId ? "ON_DEMAND" : null,
        card_generation_error: null,
        period_limit: values.periodUnit ? values.periodLimit : null,
        period_unit: values.periodUnit,
        period_timezone: values.periodTimezone,
        event_id: event.event_id
    };
    let replayed = false;

    const qrRecord = await withEventQrQuota({
        organizationId: orgId,
        eventId: event.event_id,
        resolveExisting: normalizedIdempotency ? async (tx) => {
            const existing = await findIdempotentRecord(orgId, normalizedIdempotency, tx);
            const existingQr = resolveIdempotentRecord(existing, requestHash);
            if (!existingQr) return null;
            replayed = true;
            return existingQr;
        } : null,
        create: async (tx) => {
            const created = await qrService.createQr({
                ...qrData,
                unique_token: crypto.randomUUID()
            }, tx);
            if (normalizedIdempotency) {
                await tx.passIssuanceRequest.create({
                    data: {
                        org_id: orgId,
                        scope: normalizedIdempotency.scope,
                        idempotency_key_hash: normalizedIdempotency.keyHash,
                        request_hash: requestHash,
                        qr_id: created.qr_id
                    }
                });
            }
            return created;
        }
    });

    return { qrRecord, event, replayed };
};

module.exports = {
    PassIssuanceError,
    createTemplateSnapshot,
    issuePass,
    normalizeCardData,
    requestHashFor,
    resolveCardTemplate
};
