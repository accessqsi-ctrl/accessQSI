// Règles d’abonnement pures : classification des changements de plan, calcul des devis, quotas de ressources.
const { getPaymentConfig } = require("../../config/payment");
const {
    PLAN_KEYS,
    BILLING_INTERVALS,
    SUBSCRIPTION_MONTH_DAYS,
    PLAN_DETAILS,
    getFixedPlanPrice,
    getPlanSummary
} = require("../../config/subscription");
const { PaymentValidationError } = require("./format");

const OPEN_CHANGE_STATUSES = ["AWAITING_PAYMENT", "SCHEDULED", "REFUND_PENDING"];
const PLAN_RANK = Object.freeze({
    [PLAN_KEYS.DISCOVERY]: 0,
    [PLAN_KEYS.ESSENTIAL]: 1,
    [PLAN_KEYS.PRO]: 2,
    [PLAN_KEYS.ENTERPRISE]: 3
});

const serializeChange = (change) => change ? ({
    id: change.subscription_change_id,
    type: change.type,
    status: change.status,
    effectiveAt: change.effective_at,
    fromPlan: change.from_plan?.title || null,
    toPlan: change.to_plan?.title || null,
    fromInterval: change.from_interval,
    toInterval: change.to_interval,
    quotedAmount: change.quoted_amount?.toString?.() || change.quoted_amount || null,
    quotedCurrency: change.quoted_currency,
    resourceSelection: change.resource_selection || null,
    createdAt: change.created_at,
    appliedAt: change.applied_at,
    canceledAt: change.canceled_at
}) : null;

const planSnapshot = (planKey) => {
    const details = PLAN_DETAILS[planKey] || PLAN_DETAILS.DISCOVERY;
    return {
        plan: details.key,
        limits: {
            maxEventsPerCycle: details.maxEventsPerCycle,
            maxQrCodesPerEvent: details.maxQrCodesPerEvent,
            maxAgents: details.maxAgents,
            maxAreas: details.maxAreas
        },
        capabilities: [...details.capabilities]
    };
};

const enforceResourceLimits = async (tx, orgId, planKey, selection = null) => {
    const details = PLAN_DETAILS[planKey] || PLAN_DETAILS.DISCOVERY;
    const requestedAgents = Array.isArray(selection?.agentIds) ? selection.agentIds.map(Number) : [];
    const requestedAreas = Array.isArray(selection?.areaIds) ? selection.areaIds.map(Number) : [];

    if (details.maxAgents != null) {
        const agents = await tx.userQ.findMany({
            where: {
                org_id: orgId,
                role: { in: ["ORG_AGENT", "OPERATOR"] },
                deleted_at: null,
                is_active: true
            },
            select: { user_id: true },
            orderBy: [{ created_at: "asc" }, { user_id: "asc" }]
        });
        const available = new Set(agents.map((agent) => agent.user_id));
        const retained = requestedAgents.filter((id) => available.has(id)).slice(0, details.maxAgents);
        for (const agent of agents) {
            if (retained.length >= details.maxAgents) break;
            if (!retained.includes(agent.user_id)) retained.push(agent.user_id);
        }
        const suspended = agents.map((agent) => agent.user_id).filter((id) => !retained.includes(id));
        if (suspended.length > 0) {
            await tx.userQ.updateMany({
                where: { user_id: { in: suspended }, org_id: orgId },
                data: { is_active: false, suspended_by_plan: true }
            });
        }
    }

    if (details.maxAreas != null) {
        const areas = await tx.area.findMany({
            where: { org_id: orgId, deleted_at: null, suspended_by_plan: false },
            select: { area_id: true },
            orderBy: { area_id: "asc" }
        });
        const available = new Set(areas.map((area) => area.area_id));
        const retained = requestedAreas.filter((id) => available.has(id)).slice(0, details.maxAreas);
        for (const area of areas) {
            if (retained.length >= details.maxAreas) break;
            if (!retained.includes(area.area_id)) retained.push(area.area_id);
        }
        const suspended = areas.map((area) => area.area_id).filter((id) => !retained.includes(id));
        if (suspended.length > 0) {
            await tx.area.updateMany({
                where: { area_id: { in: suspended }, org_id: orgId },
                data: { suspended_by_plan: true }
            });
        }
    }
};

const recordSubscriptionAudit = (tx, data) => tx.subscriptionAuditLog?.create
    ? tx.subscriptionAuditLog.create({ data })
    : Promise.resolve(null);

const roundForProvider = (value, decimals) => {
    const precision = Number.isInteger(Number(decimals)) ? Math.max(0, Math.min(2, Number(decimals))) : 2;
    const factor = 10 ** precision;
    return Number((Math.round((Number(value) + Number.EPSILON) * factor) / factor).toFixed(precision));
};

const classifyChange = ({ organization, targetPlan, targetInterval, now = new Date() }) => {
    const summary = getPlanSummary(organization, now);
    const currentPlan = summary.plan;
    const currentInterval = organization.subscription_interval || null;
    const activeUntil = organization.subscription_expires_at
        ? new Date(organization.subscription_expires_at)
        : null;
    const hasActiveTerm = Boolean(summary.isPaid && activeUntil && activeUntil > now);

    if (!hasActiveTerm) {
        return { type: "PURCHASE", effectiveAt: now, prorated: false };
    }
    if (organization.trial_expires_at && new Date(organization.trial_expires_at) > now) {
        return { type: currentPlan === targetPlan ? "RENEWAL" : "DOWNGRADE", effectiveAt: activeUntil, prorated: false };
    }
    if (currentPlan === targetPlan && currentInterval === targetInterval) {
        return { type: "RENEWAL", effectiveAt: activeUntil, prorated: false };
    }
    if (currentInterval !== targetInterval) {
        return { type: "INTERVAL_CHANGE", effectiveAt: activeUntil, prorated: false };
    }
    if ((PLAN_RANK[targetPlan] ?? 0) > (PLAN_RANK[currentPlan] ?? 0)) {
        return { type: "UPGRADE", effectiveAt: now, prorated: true };
    }
    return { type: "DOWNGRADE", effectiveAt: activeUntil, prorated: false };
};

const getRemainingPeriodUnits = (anchorValue, endValue, periodMonths, now = new Date()) => {
    void anchorValue;
    const end = new Date(endValue);
    const periodDuration = Number(periodMonths) * SUBSCRIPTION_MONTH_DAYS * 24 * 60 * 60 * 1000;
    return Math.max(0, end.getTime() - now.getTime()) / periodDuration;
};

const getRemainingMonthlyUnits = (anchorValue, endValue, now = new Date()) => (
    getRemainingPeriodUnits(anchorValue, endValue, 1, now)
);

const calculatePaymentQuote = ({ organization, plan, provider, billingInterval, now = new Date() }) => {
    const configuredLocalPrice = getFixedPlanPrice(plan.title, provider.currency, billingInterval);
    if (configuredLocalPrice === null) {
        throw new PaymentValidationError(
            "Aucun tarif local n'est configuré pour la devise de cet opérateur.",
            "LOCAL_PRICE_NOT_CONFIGURED"
        );
    }
    const transition = plan.title === PLAN_KEYS.EVENT_PASS
        ? null
        : classifyChange({
            organization,
            targetPlan: plan.title,
            targetInterval: billingInterval,
            now
        });
    const summary = getPlanSummary(organization, now);
    let localPrice = configuredLocalPrice;
    let referencePrice = billingInterval === BILLING_INTERVALS.ANNUAL
        ? PLAN_DETAILS[plan.title].annualPrice
        : plan.cost;
    let creditAmount = 0;

    if (transition?.prorated) {
        const oldLocalPrice = getFixedPlanPrice(
            summary.plan,
            provider.currency,
            organization.subscription_interval || BILLING_INTERVALS.MONTHLY
        );
        const oldReferencePrice = billingInterval === BILLING_INTERVALS.ANNUAL
            ? PLAN_DETAILS[summary.plan]?.annualPrice
            : PLAN_DETAILS[summary.plan]?.price;
        if (oldLocalPrice == null || oldReferencePrice == null) {
            throw new PaymentValidationError("Le crédit de l’abonnement actuel ne peut pas être calculé.", "PRORATION_NOT_AVAILABLE");
        }
        const units = getRemainingPeriodUnits(
            organization.subscription_started_at,
            organization.subscription_expires_at,
            billingInterval === BILLING_INTERVALS.ANNUAL ? 12 : 1,
            now
        );
        creditAmount = roundForProvider(oldLocalPrice * units, provider.decimals);
        localPrice = roundForProvider((configuredLocalPrice - oldLocalPrice) * units, provider.decimals);
        const targetReferencePrice = billingInterval === BILLING_INTERVALS.ANNUAL
            ? PLAN_DETAILS[plan.title].annualPrice
            : Number(plan.cost);
        referencePrice = roundForProvider((Number(targetReferencePrice) - Number(oldReferencePrice)) * units, 2);
        if (localPrice <= 0 || referencePrice <= 0) {
            throw new PaymentValidationError("Aucun montant supplémentaire n’est dû pour ce changement.", "NO_UPGRADE_PAYMENT_DUE");
        }
    }
    return { transition, localPrice, referencePrice, creditAmount, summary };
};

const arePaymentsEnabled = () => getPaymentConfig().enabled;

const selectProviderConfiguration = (providers, providerCode, countryCode, currencyCode) => {
    const normalized = String(providerCode || "").trim().toUpperCase();
    if (!normalized) {
        throw new PaymentValidationError("Choisissez un opérateur Mobile Money.", "PROVIDER_REQUIRED");
    }
    const normalizedCountry = String(countryCode || "").trim().toUpperCase();
    const matches = providers.filter((item) => (
        item.provider === normalized
        && (!normalizedCountry || item.country === normalizedCountry)
    ));
    if (matches.length === 0) {
        throw new PaymentValidationError(
            "Cet opérateur n'est pas disponible pour votre compte pawaPay.",
            "PROVIDER_NOT_AVAILABLE"
        );
    }
    const normalizedCurrency = String(currencyCode || "").trim().toUpperCase();
    if (!normalizedCurrency) {
        const currencies = new Set(matches.map((item) => item.currency).filter(Boolean));
        if (currencies.size > 1) {
            throw new PaymentValidationError(
                "Choisissez la devise de votre compte Mobile Money.",
                "CURRENCY_REQUIRED"
            );
        }
        return matches[0];
    }
    const provider = matches.find((item) => item.currency === normalizedCurrency);
    if (!provider) {
        throw new PaymentValidationError(
            "Cette devise n'est pas disponible pour l'opérateur sélectionné.",
            "CURRENCY_NOT_AVAILABLE"
        );
    }
    return provider;
};

module.exports = {
    OPEN_CHANGE_STATUSES,
    PLAN_RANK,
    serializeChange,
    planSnapshot,
    enforceResourceLimits,
    recordSubscriptionAudit,
    roundForProvider,
    classifyChange,
    getRemainingPeriodUnits,
    getRemainingMonthlyUnits,
    calculatePaymentQuote,
    arePaymentsEnabled,
    selectProviderConfiguration
};
