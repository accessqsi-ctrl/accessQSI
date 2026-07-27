const PLAN_KEYS = Object.freeze({
    FREE: "FREE",
    PRO: "PRO"
});

const PLAN_CAPABILITIES = Object.freeze({
    BULK_QR_IMPORT: "bulk_qr_import",
    CUSTOM_CARD_TEMPLATES: "custom_card_templates",
    SCAN_EXPORTS: "scan_exports",
    ADVANCED_ANALYTICS: "advanced_analytics"
});

const PLAN_DETAILS = Object.freeze({
    FREE: Object.freeze({
        key: PLAN_KEYS.FREE,
        name: "Free",
        price: 0,
        maxEvents: 3,
        maxQrCodes: 100,
        maxAgents: 4,
        maxAreas: 4,
        capabilities: Object.freeze([]),
        features: [
            "Événements de base",
            "Génération simple de QR",
            "Jusqu'à 4 agents",
            "Jusqu'à 4 zones",
            "Tableau de bord minimal"
        ]
    }),
    PRO: Object.freeze({
        key: PLAN_KEYS.PRO,
        name: "Pro",
        price: 4900,
        maxEvents: null,
        maxQrCodes: null,
        maxAgents: null,
        maxAreas: null,
        capabilities: Object.freeze(Object.values(PLAN_CAPABILITIES)),
        features: [
            "Événements illimités",
            "QR illimités",
            "Agents illimités",
            "Zones illimitées",
            "Imports CSV",
            "Templates personnalisés",
            "Exports avancés"
        ]
    })
});

const normalizePlanKey = (value) => {
    if (!value) return PLAN_KEYS.FREE;

    if (typeof value === "string") {
        const normalized = value.trim().toUpperCase();
        if (normalized === PLAN_KEYS.PRO) return PLAN_KEYS.PRO;
        if (normalized === PLAN_KEYS.FREE) return PLAN_KEYS.FREE;
        if (normalized === "PREMIUM") return PLAN_KEYS.PRO;
        if (normalized === "STANDARD") return PLAN_KEYS.FREE;
    }

    if (typeof value === "number") {
        return PLAN_KEYS.FREE;
    }

    if (value && typeof value === "object") {
        if (typeof value.title === "string") return normalizePlanKey(value.title);
        if (typeof value.key === "string") return normalizePlanKey(value.key);
        if (typeof value.name === "string") return normalizePlanKey(value.name);
    }

    return PLAN_KEYS.FREE;
};

const getPlanDetails = (organization) => {
    const planKey = normalizePlanKey(
        organization?.plan?.title
            || organization?.plan?.key
            || organization?.plan
            || organization?.subscription_plan
            || organization?.plan_name
            || organization?.planKey
    );

    return PLAN_DETAILS[planKey] || PLAN_DETAILS.FREE;
};

const getPlanSummary = (organization) => {
    const details = getPlanDetails(organization);
    return {
        plan: details.key,
        planName: details.name,
        isPro: details.key === PLAN_KEYS.PRO,
        price: details.price,
        limits: {
            maxEvents: details.maxEvents,
            maxQrCodes: details.maxQrCodes,
            maxAgents: details.maxAgents,
            maxAreas: details.maxAreas
        },
        capabilities: [...details.capabilities],
        features: details.features
    };
};

const hasPlanCapability = (planOrOrganization, capability) => {
    if (!Object.values(PLAN_CAPABILITIES).includes(capability)) return false;

    const capabilities = Array.isArray(planOrOrganization?.capabilities)
        ? planOrOrganization.capabilities
        : getPlanDetails(planOrOrganization).capabilities;

    return capabilities.includes(capability);
};

const getQuotaStatus = (limit, currentCount = 0) => {
    if (limit === null || limit === undefined) {
        return {
            allowed: true,
            limit: null,
            currentCount,
            remaining: null
        };
    }

    const remaining = Math.max(0, limit - currentCount);
    return {
        allowed: remaining > 0,
        limit,
        currentCount,
        remaining
    };
};

const getQrQuotaStatus = (planSummary, currentCount = 0) => {
    return getQuotaStatus(planSummary?.limits?.maxQrCodes, currentCount);
};

const getEventQuotaStatus = (planSummary, currentCount = 0) => {
    return getQuotaStatus(planSummary?.limits?.maxEvents, currentCount);
};

const getAgentQuotaStatus = (planSummary, currentCount = 0) => {
    return getQuotaStatus(planSummary?.limits?.maxAgents, currentCount);
};

const getAreaQuotaStatus = (planSummary, currentCount = 0) => {
    return getQuotaStatus(planSummary?.limits?.maxAreas, currentCount);
};

const getPlanUsage = (planSummary, currentUsage = {}) => {
    const resources = {
        events: ["maxEvents", currentUsage.events],
        qrCodes: ["maxQrCodes", currentUsage.qrCodes],
        agents: ["maxAgents", currentUsage.agents],
        areas: ["maxAreas", currentUsage.areas]
    };

    return Object.fromEntries(
        Object.entries(resources).map(([resource, [limitKey, count]]) => {
            const status = getQuotaStatus(planSummary?.limits?.[limitKey], Number(count) || 0);
            return [resource, {
                used: status.currentCount,
                limit: status.limit,
                remaining: status.remaining,
                reached: !status.allowed
            }];
        })
    );
};

const isOrganizationOnPlan = (organization, expectedPlan) => {
    const planKey = normalizePlanKey(expectedPlan);
    return getPlanDetails(organization).key === planKey;
};

const ensureDefaultPlans = async (prismaClient) => {
    const defaults = Object.values(PLAN_DETAILS).map((details) => ({
        title: details.key,
        cost: details.price,
        features: [...details.capabilities]
    }));

    for (const plan of defaults) {
        await prismaClient.plan.upsert({
            where: { title: plan.title },
            update: { cost: plan.cost, features: plan.features },
            create: plan
        });
    }

    return prismaClient.plan.findMany({
        select: { plan_id: true, title: true, cost: true, features: true }
    });
};

const getPlanByKey = async (prismaClient, planKey) => {
    const normalizedKey = normalizePlanKey(planKey);
    await ensureDefaultPlans(prismaClient);

    return prismaClient.plan.findUnique({
        where: { title: normalizedKey },
        select: { plan_id: true, title: true, cost: true, features: true }
    });
};

const assignOrganizationPlan = async (prismaClient, orgId, planKey = PLAN_KEYS.FREE) => {
    const plan = await getPlanByKey(prismaClient, planKey);
    if (!plan) return null;

    await prismaClient.organization.update({
        where: { org_id: orgId },
        data: { subscription_plan: plan.plan_id }
    });

    return plan;
};

module.exports = {
    PLAN_KEYS,
    PLAN_CAPABILITIES,
    PLAN_DETAILS,
    normalizePlanKey,
    getPlanDetails,
    getPlanSummary,
    hasPlanCapability,
    getQuotaStatus,
    getQrQuotaStatus,
    getEventQuotaStatus,
    getAgentQuotaStatus,
    getAreaQuotaStatus,
    getPlanUsage,
    isOrganizationOnPlan,
    ensureDefaultPlans,
    getPlanByKey,
    assignOrganizationPlan
};
