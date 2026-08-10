const PLAN_KEYS = Object.freeze({
    DISCOVERY: "DISCOVERY",
    FREE: "DISCOVERY",
    ESSENTIAL: "ESSENTIAL",
    PRO: "PRO",
    ENTERPRISE: "ENTERPRISE",
    EVENT_PASS: "EVENT_PASS"
});

const BILLING_INTERVALS = Object.freeze({
    MONTHLY: "MONTHLY",
    ANNUAL: "ANNUAL",
    ONE_TIME: "ONE_TIME"
});

const DEFAULT_TRIAL_DURATION_DAYS = 30;
const EVENT_PASS_DURATION_DAYS = 30;
const PDF_PAGES_PER_FILE = 200;

const getTrialDurationDays = () => {
    const configured = Number.parseInt(process.env.PRO_TRIAL_DURATION_DAYS || "", 10);
    return Number.isInteger(configured) && configured >= 1 && configured <= 90
        ? configured
        : DEFAULT_TRIAL_DURATION_DAYS;
};

const PLAN_CAPABILITIES = Object.freeze({
    BULK_QR_IMPORT: "bulk_qr_import",
    CUSTOM_CARD_TEMPLATES: "custom_card_templates",
    SCAN_EXPORTS: "scan_exports",
    ADVANCED_ANALYTICS: "advanced_analytics"
});

const scalePrices = (factor) => Object.freeze({
    USD: Number((10 * factor).toFixed(2)),
    CDF: Math.round(23000 * factor),
    XOF: Math.round(5800 * factor),
    XAF: Math.round(5800 * factor),
    RWF: Math.round(14700 * factor),
    ZMW: Math.round(185 * factor),
    KES: Math.round(1300 * factor),
    UGX: Math.round(37000 * factor),
    TZS: Math.round(26300 * factor),
    NGN: Math.round(13700 * factor),
    GHS: Math.round(117 * factor)
});

const ESSENTIAL_FIXED_PRICES = scalePrices(1.5);
const ESSENTIAL_ANNUAL_FIXED_PRICES = scalePrices(14.4);
const PRO_FIXED_PRICES = scalePrices(2.5);
const PRO_ANNUAL_FIXED_PRICES = scalePrices(24);
const EVENT_PASS_FIXED_PRICES = scalePrices(0.7);

const PLAN_DETAILS = Object.freeze({
    DISCOVERY: Object.freeze({
        key: PLAN_KEYS.DISCOVERY,
        name: "Découverte",
        price: 0,
        currency: "USD",
        maxEventsPerCycle: 1,
        maxQrCodesPerEvent: 50,
        maxAgents: 2,
        maxAreas: 2,
        capabilities: Object.freeze([]),
        features: ["1 événement par mois", "50 QR par événement", "2 agents actifs", "2 zones actives", "Dashboard basique"]
    }),
    ESSENTIAL: Object.freeze({
        key: PLAN_KEYS.ESSENTIAL,
        name: "Essential",
        price: ESSENTIAL_FIXED_PRICES.USD,
        annualPrice: ESSENTIAL_ANNUAL_FIXED_PRICES.USD,
        currency: "USD",
        fixedPrices: ESSENTIAL_FIXED_PRICES,
        annualFixedPrices: ESSENTIAL_ANNUAL_FIXED_PRICES,
        maxEventsPerCycle: 5,
        maxQrCodesPerEvent: 200,
        maxAgents: 5,
        maxAreas: 6,
        capabilities: Object.freeze([
            PLAN_CAPABILITIES.BULK_QR_IMPORT,
            PLAN_CAPABILITIES.SCAN_EXPORTS
        ]),
        features: ["5 événements par mois", "200 QR par événement", "5 agents actifs", "6 zones actives", "Dashboard fonctionnel"]
    }),
    PRO: Object.freeze({
        key: PLAN_KEYS.PRO,
        name: "Pro",
        price: PRO_FIXED_PRICES.USD,
        annualPrice: PRO_ANNUAL_FIXED_PRICES.USD,
        currency: "USD",
        fixedPrices: PRO_FIXED_PRICES,
        annualFixedPrices: PRO_ANNUAL_FIXED_PRICES,
        maxEventsPerCycle: 10,
        maxQrCodesPerEvent: 700,
        maxAgents: 15,
        maxAreas: 20,
        capabilities: Object.freeze(Object.values(PLAN_CAPABILITIES)),
        features: ["10 événements par mois", "700 QR par événement", "15 agents actifs", "20 zones actives", "Analytics et modèles avancés"]
    }),
    ENTERPRISE: Object.freeze({
        key: PLAN_KEYS.ENTERPRISE,
        name: "Entreprise",
        price: 0,
        displayPrice: null,
        currency: "USD",
        maxEventsPerCycle: null,
        maxQrCodesPerEvent: null,
        maxAgents: null,
        maxAreas: null,
        capabilities: Object.freeze(Object.values(PLAN_CAPABILITIES)),
        features: ["Volumes élevés", "Support événementiel", "Personnalisation", "SLA sur mesure"]
    }),
    EVENT_PASS: Object.freeze({
        key: PLAN_KEYS.EVENT_PASS,
        name: "Pass événement",
        price: EVENT_PASS_FIXED_PRICES.USD,
        currency: "USD",
        fixedPrices: EVENT_PASS_FIXED_PRICES,
        maxEventsPerCycle: 1,
        maxQrCodesPerEvent: 200,
        maxAgents: null,
        maxAreas: null,
        durationDays: EVENT_PASS_DURATION_DAYS,
        capabilities: Object.freeze([]),
        features: ["1 événement", "200 QR", "Valable 30 jours après attribution"]
    })
});

const normalizePlanKey = (value) => {
    if (!value) return PLAN_KEYS.DISCOVERY;
    if (typeof value === "string") {
        const normalized = value.trim().toUpperCase();
        if (["FREE", "STANDARD", "DISCOVERY", "DÉCOUVERTE", "DECOUVERTE"].includes(normalized)) return PLAN_KEYS.DISCOVERY;
        if (normalized === PLAN_KEYS.ESSENTIAL) return PLAN_KEYS.ESSENTIAL;
        if ([PLAN_KEYS.PRO, "PREMIUM"].includes(normalized)) return PLAN_KEYS.PRO;
        if ([PLAN_KEYS.ENTERPRISE, "ENTREPRISE"].includes(normalized)) return PLAN_KEYS.ENTERPRISE;
        if ([PLAN_KEYS.EVENT_PASS, "PASS", "PASS_EVENT"].includes(normalized)) return PLAN_KEYS.EVENT_PASS;
    }
    if (value && typeof value === "object") {
        return normalizePlanKey(value.title || value.key || value.name);
    }
    return PLAN_KEYS.DISCOVERY;
};

const isSubscriptionExpired = (organization, now = new Date()) => Boolean(
    organization?.subscription_expires_at
    && new Date(organization.subscription_expires_at).getTime() <= now.getTime()
);

const getPlanDetails = (organization, now = new Date()) => {
    if (isSubscriptionExpired(organization, now)) return PLAN_DETAILS.DISCOVERY;
    const planKey = normalizePlanKey(
        organization?.plan?.title
        || organization?.plan?.key
        || organization?.plan
        || organization?.plan_name
        || organization?.planKey
    );
    if (planKey === PLAN_KEYS.EVENT_PASS) return PLAN_DETAILS.DISCOVERY;
    const details = PLAN_DETAILS[planKey] || PLAN_DETAILS.DISCOVERY;
    if (planKey !== PLAN_KEYS.ENTERPRISE || !organization?.enterprise_entitlements) return details;
    const custom = organization.enterprise_entitlements;
    const numericLimit = (key, fallback) => (
        custom[key] === null || (Number.isInteger(Number(custom[key])) && Number(custom[key]) >= 0)
            ? custom[key] === null ? null : Number(custom[key])
            : fallback
    );
    return {
        ...details,
        maxEventsPerCycle: numericLimit("maxEventsPerCycle", details.maxEventsPerCycle),
        maxQrCodesPerEvent: numericLimit("maxQrCodesPerEvent", details.maxQrCodesPerEvent),
        maxAgents: numericLimit("maxAgents", details.maxAgents),
        maxAreas: numericLimit("maxAreas", details.maxAreas),
        capabilities: Array.isArray(custom.capabilities)
            ? Object.freeze(custom.capabilities.filter((item) => Object.values(PLAN_CAPABILITIES).includes(item)))
            : details.capabilities
    };
};

const addUtcMonths = (date, months) => {
    const source = new Date(date);
    const day = source.getUTCDate();
    const result = new Date(source);
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
};

const getMonthlyCycle = (organization, now = new Date()) => {
    const anchor = new Date(organization?.subscription_started_at || organization?.created_at || now);
    if (anchor > now) return { start: new Date(now), end: addUtcMonths(now, 1) };
    let elapsedMonths = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12
        + now.getUTCMonth() - anchor.getUTCMonth();
    let start = addUtcMonths(anchor, elapsedMonths);
    if (start > now) {
        elapsedMonths -= 1;
        start = addUtcMonths(anchor, elapsedMonths);
    }
    const end = addUtcMonths(anchor, elapsedMonths + 1);
    return { start, end };
};

const getPlanSummary = (organization, now = new Date()) => {
    const details = getPlanDetails(organization, now);
    const nowTime = now.getTime();
    const trialStartedAt = organization?.trial_started_at || null;
    const trialExpiresAt = organization?.trial_expires_at || null;
    const subscriptionExpiresAt = organization?.subscription_expires_at || null;
    const trialExpiryTime = trialExpiresAt ? new Date(trialExpiresAt).getTime() : null;
    const subscriptionExpiryTime = subscriptionExpiresAt ? new Date(subscriptionExpiresAt).getTime() : null;
    const isPro = [PLAN_KEYS.PRO, PLAN_KEYS.ENTERPRISE].includes(details.key);
    const isPaid = [PLAN_KEYS.ESSENTIAL, PLAN_KEYS.PRO, PLAN_KEYS.ENTERPRISE].includes(details.key);
    const isTrial = Boolean(isPro && trialStartedAt && trialExpiryTime > nowTime && (!subscriptionExpiryTime || subscriptionExpiryTime <= trialExpiryTime));
    const cycle = getMonthlyCycle(organization, now);

    return {
        plan: details.key,
        planName: details.name,
        isPro,
        isPaid,
        isTrial,
        subscriptionType: isTrial ? "TRIAL" : isPaid ? "PAID" : "FREE",
        billingInterval: organization?.subscription_interval || null,
        downgraded: isSubscriptionExpired(organization, now),
        trialAvailable: process.env.ENABLE_PRO_TRIAL === "true" && !trialStartedAt && !isPaid,
        trialDurationDays: getTrialDurationDays(),
        trialStartedAt,
        trialExpiresAt,
        price: details.price,
        annualPrice: details.annualPrice || null,
        currency: details.currency,
        startedAt: organization?.subscription_started_at || null,
        expiresAt: subscriptionExpiresAt,
        cycleStartedAt: cycle.start,
        cycleEndsAt: cycle.end,
        limits: {
            maxEvents: details.maxEventsPerCycle,
            maxEventsPerCycle: details.maxEventsPerCycle,
            maxQrCodes: details.maxQrCodesPerEvent,
            maxQrCodesPerEvent: details.maxQrCodesPerEvent,
            maxAgents: details.maxAgents,
            maxAreas: details.maxAreas,
            maxPdfPagesPerFile: PDF_PAGES_PER_FILE
        },
        capabilities: [...details.capabilities],
        features: details.features
    };
};

const getFixedPlanPrice = (planKey, currency, billingInterval = BILLING_INTERVALS.MONTHLY) => {
    const normalizedPlan = normalizePlanKey(planKey);
    const normalizedCurrency = String(currency || "").trim().toUpperCase();
    const details = PLAN_DETAILS[normalizedPlan];
    if (!details) return null;
    if (normalizedPlan === PLAN_KEYS.DISCOVERY) return normalizedCurrency === "USD" ? 0 : null;
    if (billingInterval === BILLING_INTERVALS.ANNUAL) return details.annualFixedPrices?.[normalizedCurrency] ?? null;
    return details.fixedPrices?.[normalizedCurrency] ?? null;
};

const hasPlanCapability = (planOrOrganization, capability) => {
    if (!Object.values(PLAN_CAPABILITIES).includes(capability)) return false;
    const capabilities = Array.isArray(planOrOrganization?.capabilities)
        ? planOrOrganization.capabilities
        : getPlanDetails(planOrOrganization).capabilities;
    return capabilities.includes(capability);
};

const getQuotaStatus = (limit, currentCount = 0) => {
    if (limit === null || limit === undefined) return { allowed: true, limit: null, currentCount, remaining: null };
    const remaining = Math.max(0, limit - currentCount);
    return { allowed: remaining > 0, limit, currentCount, remaining };
};

const getQrQuotaStatus = (summary, count = 0) => getQuotaStatus(summary?.limits?.maxQrCodesPerEvent, count);
const getEventQuotaStatus = (summary, count = 0) => getQuotaStatus(summary?.limits?.maxEventsPerCycle, count);
const getAgentQuotaStatus = (summary, count = 0) => getQuotaStatus(summary?.limits?.maxAgents, count);
const getAreaQuotaStatus = (summary, count = 0) => getQuotaStatus(summary?.limits?.maxAreas, count);

const getPlanUsage = (summary, usage = {}) => {
    const resources = {
        events: ["maxEventsPerCycle", usage.events],
        qrCodes: ["maxQrCodesPerEvent", usage.qrCodes],
        agents: ["maxAgents", usage.agents],
        areas: ["maxAreas", usage.areas]
    };
    return Object.fromEntries(Object.entries(resources).map(([resource, [key, count]]) => {
        const status = getQuotaStatus(summary?.limits?.[key], Number(count) || 0);
        return [resource, { used: status.currentCount, limit: status.limit, remaining: status.remaining, reached: !status.allowed }];
    }));
};

const isOrganizationOnPlan = (organization, expectedPlan) => getPlanDetails(organization).key === normalizePlanKey(expectedPlan);

const ensureDefaultPlans = async (prismaClient) => {
    const defaults = Object.values(PLAN_DETAILS).map((details) => ({
        title: details.key,
        cost: details.price,
        currency: details.currency,
        features: [...details.capabilities]
    }));
    for (const plan of defaults) {
        await prismaClient.plan.upsert({
            where: { title: plan.title },
            update: { cost: plan.cost, currency: plan.currency, features: plan.features },
            create: plan
        });
    }
    return prismaClient.plan.findMany({ select: { plan_id: true, title: true, cost: true, currency: true, features: true } });
};

const getPlanByKey = async (prismaClient, planKey) => {
    const normalizedKey = normalizePlanKey(planKey);
    await ensureDefaultPlans(prismaClient);
    return prismaClient.plan.findUnique({
        where: { title: normalizedKey },
        select: { plan_id: true, title: true, cost: true, currency: true, features: true }
    });
};

const assignOrganizationPlan = async (prismaClient, orgId, planKey = PLAN_KEYS.DISCOVERY) => {
    const plan = await getPlanByKey(prismaClient, planKey);
    if (!plan) return null;
    await prismaClient.organization.update({ where: { org_id: orgId }, data: { subscription_plan: plan.plan_id } });
    return plan;
};

module.exports = {
    PLAN_KEYS,
    BILLING_INTERVALS,
    DEFAULT_TRIAL_DURATION_DAYS,
    EVENT_PASS_DURATION_DAYS,
    PDF_PAGES_PER_FILE,
    PLAN_CAPABILITIES,
    ESSENTIAL_FIXED_PRICES,
    ESSENTIAL_ANNUAL_FIXED_PRICES,
    PRO_FIXED_PRICES,
    PRO_ANNUAL_FIXED_PRICES,
    EVENT_PASS_FIXED_PRICES,
    PLAN_DETAILS,
    normalizePlanKey,
    isSubscriptionExpired,
    getTrialDurationDays,
    getPlanDetails,
    addUtcMonths,
    getMonthlyCycle,
    getPlanSummary,
    getFixedPlanPrice,
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
