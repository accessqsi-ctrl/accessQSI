const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const pawaPay = require("./pawapay.service");
const logger = require("../utils/logger");
const { getPaymentConfig } = require("../config/payment");
const {
    PLAN_KEYS,
    BILLING_INTERVALS,
    SUBSCRIPTION_MONTH_DAYS,
    PLAN_DETAILS,
    ensureDefaultPlans,
    getFixedPlanPrice,
    getPlanByKey,
    getPlanSummary,
    addUtcMonths,
    getTrialDurationDays
} = require("../config/subscription");

class PaymentValidationError extends Error {
    constructor(message, code = "PAYMENT_VALIDATION_ERROR") {
        super(message);
        this.name = "PaymentValidationError";
        this.code = code;
    }
}

const normalizePhoneNumber = (value, options = {}) => {
    const country = typeof options === "string" ? options : options.country;
    const prefix = typeof options === "object" ? String(options.prefix || "").replace(/\D/g, "") : "";
    const digits = String(value || "").replace(/\D/g, "");

    if (country === "COD" || prefix === "243") {
        let national = digits;
        if (national.startsWith("243")) national = national.slice(3);
        if (national.startsWith("0")) national = national.slice(1);
        if (!/^[1-9]\d{8}$/.test(national)) {
            throw new PaymentValidationError(
                "Utilisez un numéro congolais valide, par exemple 0991234567.",
                "INVALID_PHONE_NUMBER"
            );
        }
        return `243${national}`;
    }

    if (!prefix) {
        if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
            throw new PaymentValidationError(
                "Saisissez le numéro au format international avec l'indicatif du pays.",
                "INVALID_PHONE_NUMBER"
            );
        }
        return digits;
    }

    let national = digits;
    if (national.startsWith(prefix)) national = national.slice(prefix.length);
    if (national.startsWith("0")) national = national.slice(1);
    const international = `${prefix}${national}`;
    if (!/^[1-9]\d{7,14}$/.test(international)) {
        throw new PaymentValidationError(
            "Le numéro Mobile Money est invalide pour le pays sélectionné.",
            "INVALID_PHONE_NUMBER"
        );
    }
    return international;
};

const maskPhoneNumber = (phoneNumber) => {
    const value = String(phoneNumber || "");
    if (value.length <= 6) return value;
    return `${value.slice(0, 4)}••••${value.slice(-3)}`;
};

const buildPaymentReason = ({ planKey, billingInterval, transitionType } = {}) => {
    if (planKey === PLAN_KEYS.EVENT_PASS) return "Achat d’un Pass événement AccessQ";

    const planName = PLAN_DETAILS[planKey]?.name || planKey || "AccessQ";
    const intervalLabel = billingInterval === BILLING_INTERVALS.ANNUAL ? "annuel" : "mensuel";
    switch (transitionType) {
    case "RENEWAL":
        return `Renouvellement de l’abonnement ${planName} (${intervalLabel})`;
    case "UPGRADE":
        return `Passage à l’abonnement ${planName} (${intervalLabel})`;
    case "DOWNGRADE":
        return `Changement vers l’abonnement ${planName} (${intervalLabel})`;
    case "INTERVAL_CHANGE":
        return `Passage à l’abonnement ${planName} ${intervalLabel}`;
    default:
        return `Achat de l’abonnement ${planName} (${intervalLabel})`;
    }
};

const buildProviderCustomerMessage = ({ planKey, billingInterval, transitionType } = {}) => {
    if (planKey === PLAN_KEYS.EVENT_PASS) return "AccessQ Pass evenement";
    const planName = PLAN_DETAILS[planKey]?.name || planKey || "Plan";
    if (transitionType === "RENEWAL") return `Renouv AccessQ ${planName}`.slice(0, 22);
    if (transitionType === "UPGRADE") return `Passage AccessQ ${planName}`.slice(0, 22);
    const intervalLabel = billingInterval === BILLING_INTERVALS.ANNUAL ? "annuel" : "mensuel";
    return `AccessQ ${planName} ${intervalLabel}`.slice(0, 22);
};

const extractPawaPayFailure = (payload) => {
    const normalizedPayload = Array.isArray(payload) ? payload[0] : payload;
    const source = normalizedPayload?.failureReason
        || normalizedPayload?.errors?.[0]
        || normalizedPayload?.data?.failureReason
        || normalizedPayload?.error?.failureReason
        || normalizedPayload?.data?.error
        || normalizedPayload?.error
        || normalizedPayload
        || {};
    return {
        code: source.failureCode || source.code || normalizedPayload?.status || null,
        message: typeof source === "string"
            ? source
            : source.failureMessage || source.message || source.errorMessage || source.detail || null
    };
};

const publicPaymentFailureMessage = (payload) => {
    const failure = extractPawaPayFailure(payload);
    const searchable = `${failure.code || ""} ${failure.message || ""}`.toLowerCase();

    if (/(msisdn|phone|payer|subscriber).*(too long|longer|max(imum)? length)|too long.*(msisdn|phone|payer)/.test(searchable)) {
        return "Le numéro saisi est trop long pour ce pays.";
    }
    if (/(msisdn|phone|payer|subscriber).*(too short|shorter|min(imum)? length)|too short.*(msisdn|phone|payer)/.test(searchable)) {
        return "Le numéro saisi est trop court pour ce pays.";
    }
    if (/(invalid|incorrect|malformed).*(msisdn|phone|payer|subscriber)|(msisdn|phone|payer).*(invalid|incorrect|format)/.test(searchable)) {
        return "Le numéro saisi n’est pas valide pour ce pays.";
    }
    if (/payer.not.found|subscriber.not.found|unknown subscriber|number.*not found/.test(searchable)) {
        return "Ce numéro Mobile Money n’a pas été reconnu par l’opérateur.";
    }
    if (/insufficient|not.enough.funds|balance.*low/.test(searchable)) {
        return "Le solde du compte Mobile Money est insuffisant.";
    }
    if (/limit.*(reached|exceeded)|payer.limit|transaction.limit/.test(searchable)) {
        return "La limite de transaction de ce compte Mobile Money a été atteinte.";
    }
    if (/expired|timeout|timed.out/.test(searchable)) {
        return "La demande de paiement a expiré. Veuillez réessayer.";
    }
    if (/cancelled.by.(payer|customer|user)|user.cancelled|payer.cancelled/.test(searchable)) {
        return "Le paiement a été annulé sur le téléphone.";
    }
    if (/declined|not.approved|rejected|payment.refused/.test(searchable)) {
        return "Le paiement a été refusé. Vérifiez votre compte Mobile Money puis réessayez.";
    }
    if (/provider.*(unavailable|offline|not available)|temporarily.unavailable/.test(searchable)) {
        return "L’opérateur Mobile Money est temporairement indisponible. Veuillez réessayer plus tard.";
    }
    if (/unsupported.*(provider|operator)|provider.*not.supported/.test(searchable)) {
        return "Cet opérateur Mobile Money n’est pas pris en charge.";
    }
    if (/unsupported.*country|country.*not.supported|invalid.country/.test(searchable)) {
        return "Les paiements Mobile Money ne sont pas disponibles pour ce pays.";
    }
    if (/amount.*(too low|below|min)|minimum.*amount/.test(searchable)) {
        return "Le montant est inférieur au minimum accepté par l’opérateur.";
    }
    if (/amount.*(too high|above|max)|maximum.*amount/.test(searchable)) {
        return "Le montant dépasse le maximum accepté par l’opérateur.";
    }
    if (/currency.*(invalid|unsupported|not supported)/.test(searchable)) {
        return "La devise sélectionnée n’est pas acceptée par cet opérateur.";
    }
    return "Le paiement n’a pas pu être traité. Vérifiez les informations saisies puis réessayez.";
};

const serializePayment = (payment) => ({
    id: payment.payment_id,
    depositId: payment.deposit_id,
    plan: payment.plan?.title || null,
    billingInterval: payment.billing_interval,
    reason: buildPaymentReason({
        planKey: payment.plan?.title,
        billingInterval: payment.billing_interval,
        transitionType: payment.subscription_change?.type
    }),
    amount: payment.amount?.toString?.() || String(payment.amount),
    currency: payment.currency,
    referenceAmount: payment.reference_amount == null
        ? null
        : payment.reference_amount?.toString?.() || String(payment.reference_amount),
    referenceCurrency: payment.reference_currency || null,
    country: payment.country,
    provider: payment.provider,
    phoneNumber: maskPhoneNumber(payment.phone_number),
    status: payment.status,
    providerTransactionId: payment.provider_transaction_id,
    failureCode: payment.failure_code,
    failureMessage: payment.failure_message
        ? publicPaymentFailureMessage({
            failureCode: payment.failure_code,
            failureMessage: payment.failure_message
        })
        : null,
    accessStartsAt: payment.access_starts_at,
    accessExpiresAt: payment.access_expires_at,
    createdAt: payment.created_at,
    completedAt: payment.completed_at,
    change: payment.subscription_change ? {
        id: payment.subscription_change.subscription_change_id,
        type: payment.subscription_change.type,
        status: payment.subscription_change.status,
        effectiveAt: payment.subscription_change.effective_at,
        fromPlan: payment.subscription_change.from_plan?.title || null,
        toPlan: payment.subscription_change.to_plan?.title || payment.plan?.title || null
    } : null
});

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

const getProviders = async () => {
    const paymentConfig = getPaymentConfig();
    if (!paymentConfig.enabled) return [];

    const supportedCurrencies = Object.keys(PLAN_DETAILS.PRO.fixedPrices);
    if (paymentConfig.providerAllowlist.length > 0 && !process.env.PAWAPAY_API_TOKEN) {
        return paymentConfig.providerAllowlist.map((provider) => {
            const currency = PLAN_DETAILS.PRO.currency;
            return {
                provider,
                displayName: provider.replace(/_/g, " "),
                country: paymentConfig.country || provider.split("_").at(-1),
                currency,
                price: getFixedPlanPrice(PLAN_KEYS.PRO, currency),
                prices: {
                    ESSENTIAL_MONTHLY: getFixedPlanPrice(PLAN_KEYS.ESSENTIAL, currency, BILLING_INTERVALS.MONTHLY),
                    ESSENTIAL_ANNUAL: getFixedPlanPrice(PLAN_KEYS.ESSENTIAL, currency, BILLING_INTERVALS.ANNUAL),
                    PRO_MONTHLY: getFixedPlanPrice(PLAN_KEYS.PRO, currency, BILLING_INTERVALS.MONTHLY),
                    PRO_ANNUAL: getFixedPlanPrice(PLAN_KEYS.PRO, currency, BILLING_INTERVALS.ANNUAL),
                    EVENT_PASS: getFixedPlanPrice(PLAN_KEYS.EVENT_PASS, currency, BILLING_INTERVALS.ONE_TIME)
                }
            };
        });
    }

    const configuration = await pawaPay.getActiveConfiguration();
    const providers = pawaPay.extractProviders(configuration);
    return providers.filter((provider) => (
        provider.supportsDeposit !== false
        && supportedCurrencies.includes(provider.currency)
        && (
            paymentConfig.providerAllowlist.length === 0
            || paymentConfig.providerAllowlist.includes(provider.provider)
        )
    )).map((provider) => ({
        ...provider,
        price: getFixedPlanPrice(PLAN_KEYS.PRO, provider.currency),
        prices: {
            ESSENTIAL_MONTHLY: getFixedPlanPrice(PLAN_KEYS.ESSENTIAL, provider.currency, BILLING_INTERVALS.MONTHLY),
            ESSENTIAL_ANNUAL: getFixedPlanPrice(PLAN_KEYS.ESSENTIAL, provider.currency, BILLING_INTERVALS.ANNUAL),
            PRO_MONTHLY: getFixedPlanPrice(PLAN_KEYS.PRO, provider.currency, BILLING_INTERVALS.MONTHLY),
            PRO_ANNUAL: getFixedPlanPrice(PLAN_KEYS.PRO, provider.currency, BILLING_INTERVALS.ANNUAL),
            EVENT_PASS: getFixedPlanPrice(PLAN_KEYS.EVENT_PASS, provider.currency, BILLING_INTERVALS.ONE_TIME)
        }
    }));
};

const getPlans = async () => {
    await ensureDefaultPlans(prisma);
    const plans = await prisma.plan.findMany({ orderBy: { cost: "asc" } });
    return plans.map((plan) => {
        const details = PLAN_DETAILS[plan.title] || {};
        return {
            id: plan.plan_id,
            key: plan.title,
            name: details.name || plan.title,
            price: plan.title === PLAN_KEYS.ENTERPRISE ? null : plan.cost,
            currency: plan.currency,
            localPrices: details.fixedPrices || {},
            annualPrice: details.annualPrice || null,
            annualLocalPrices: details.annualFixedPrices || {},
            features: details.features || [],
            durationDays: details.durationDays || ([PLAN_KEYS.ESSENTIAL, PLAN_KEYS.PRO].includes(plan.title) ? 30 : null),
            limits: plan.title === PLAN_KEYS.EVENT_PASS ? {
                events: 1,
                qrCodesPerEvent: details.maxQrCodesPerEvent
            } : {
                eventsPerCycle: details.maxEventsPerCycle,
                qrCodesPerEvent: details.maxQrCodesPerEvent,
                agents: details.maxAgents,
                areas: details.maxAreas
            }
        };
    });
};

const ensureSubscription = async (db, organization) => {
    const fallbackPlan = organization.subscription_plan
        || (await getPlanByKey(db, PLAN_KEYS.DISCOVERY))?.plan_id;
    return db.subscription.upsert({
        where: { org_id: organization.org_id },
        update: {},
        create: {
            org_id: organization.org_id,
            plan_id: fallbackPlan,
            status: organization.trial_expires_at && new Date(organization.trial_expires_at) > new Date()
                ? "TRIALING"
                : organization.subscription_expires_at && new Date(organization.subscription_expires_at) <= new Date()
                    ? "EXPIRED"
                    : "ACTIVE",
            billing_interval: organization.subscription_interval,
            current_period_start: organization.subscription_started_at || organization.created_at || new Date(),
            current_period_end: organization.subscription_expires_at
        }
    });
};

const applyScheduledChange = async (changeId, now = new Date()) => prisma.$transaction(async (tx) => {
    const initial = await tx.subscriptionChange.findUnique({
        where: { subscription_change_id: changeId }
    });
    if (!initial || initial.status !== "SCHEDULED" || !initial.effective_at || initial.effective_at > now) return null;

    await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${initial.org_id} FOR UPDATE`);
    const change = await tx.subscriptionChange.findUnique({
        where: { subscription_change_id: changeId },
        include: { to_plan: true, payment: true }
    });
    if (!change || change.status !== "SCHEDULED" || change.effective_at > now) return null;

    const organization = await tx.organization.findUnique({ where: { org_id: change.org_id } });
    const subscription = await ensureSubscription(tx, organization);
    if (subscription.version !== change.source_version) {
        return tx.subscriptionChange.update({
            where: { subscription_change_id: changeId },
            data: { status: "REVIEW_REQUIRED", reason: "SUBSCRIPTION_VERSION_CHANGED" }
        });
    }

    const discovery = change.type === "CANCEL";
    const targetPlan = discovery
        ? await getPlanByKey(tx, PLAN_KEYS.DISCOVERY)
        : change.to_plan;
    const startsAt = change.effective_at;
    const expiresAt = discovery
        ? null
        : addUtcMonths(startsAt, change.to_interval === BILLING_INTERVALS.ANNUAL ? 12 : 1);

    // Cancellation never deletes customer data. Discovery limits are applied
    // automatically, without asking the customer to choose resources first.
    // Any legacy selection saved on a cancellation is deliberately ignored.
    await enforceResourceLimits(
        tx,
        change.org_id,
        targetPlan.title,
        discovery ? null : change.resource_selection
    );

    await tx.organization.update({
        where: { org_id: change.org_id },
        data: {
            subscription_plan: targetPlan.plan_id,
            subscription_started_at: startsAt,
            subscription_expires_at: expiresAt,
            subscription_interval: discovery ? null : change.to_interval,
            trial_expires_at: null
        }
    });
    await tx.subscription.update({
        where: { subscription_id: subscription.subscription_id },
        data: {
            plan_id: targetPlan.plan_id,
            status: discovery ? "CANCELED" : "ACTIVE",
            billing_interval: discovery ? null : change.to_interval,
            current_period_start: startsAt,
            current_period_end: expiresAt,
            cancel_at_period_end: false,
            version: { increment: 1 }
        }
    });
    await tx.subscriptionPeriod.create({
        data: {
            org_id: change.org_id,
            plan_id: targetPlan.plan_id,
            payment_id: change.payment?.payment_id || null,
            billing_interval: discovery ? null : change.to_interval,
            starts_at: startsAt,
            ends_at: expiresAt,
            source: change.type,
            entitlement_snapshot: planSnapshot(targetPlan.title)
        }
    });
    await recordSubscriptionAudit(tx, {
        org_id: change.org_id,
        action: `SUBSCRIPTION_CHANGE_${change.type}_APPLIED`,
        before_snapshot: { planId: change.from_plan_id, interval: change.from_interval },
        after_snapshot: { planId: targetPlan.plan_id, interval: discovery ? null : change.to_interval, startsAt, expiresAt }
    });
    return tx.subscriptionChange.update({
        where: { subscription_change_id: changeId },
        data: { status: "APPLIED", applied_at: now }
    });
});

const applyDueSubscriptionChanges = async (orgId = null, now = new Date()) => {
    const due = await prisma.subscriptionChange.findMany({
        where: {
            ...(orgId ? { org_id: orgId } : {}),
            status: "SCHEDULED",
            effective_at: { lte: now }
        },
        select: { subscription_change_id: true },
        orderBy: { effective_at: "asc" },
        take: 100
    });
    const results = [];
    for (const item of due) {
        results.push(await applyScheduledChange(item.subscription_change_id, now));
    }
    const expired = await prisma.subscription.findMany({
        where: {
            ...(orgId ? { org_id: orgId } : {}),
            status: { in: ["ACTIVE", "TRIALING"] },
            current_period_end: { lte: now }
        },
        select: { subscription_id: true, org_id: true }
    });
    for (const subscription of expired) {
        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${subscription.org_id} FOR UPDATE`);
            await enforceResourceLimits(tx, subscription.org_id, PLAN_KEYS.DISCOVERY);
            await tx.subscription.updateMany({
                where: {
                    subscription_id: subscription.subscription_id,
                    status: { in: ["ACTIVE", "TRIALING"] },
                    current_period_end: { lte: now }
                },
                data: { status: "EXPIRED" }
            });
        });
    }
    return results.filter(Boolean);
};

const getBillingOverview = async (orgId) => {
    await applyDueSubscriptionChanges(orgId);
    const [organization, payments, eventPasses, openChange] = await Promise.all([
        prisma.organization.findUnique({
            where: { org_id: orgId },
            include: { plan: true }
        }),
        prisma.payment.findMany({
            where: { org_id: orgId },
            include: {
                plan: true,
                subscription_change: { include: { from_plan: true, to_plan: true } }
            },
            orderBy: { created_at: "desc" },
            take: 20
        }),
        prisma.eventPass.findMany({
            where: { org_id: orgId },
            include: { event: { select: { event_id: true, title: true } } },
            orderBy: { purchased_at: "desc" }
        }),
        prisma.subscriptionChange.findFirst({
            where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } },
            include: { from_plan: true, to_plan: true },
            orderBy: { created_at: "desc" }
        })
    ]);
    if (!organization) {
        throw new PaymentValidationError("Organisation introuvable.", "ORGANIZATION_NOT_FOUND");
    }

    return {
        subscription: {
            ...getPlanSummary(organization),
            startedAt: organization.subscription_started_at,
            expiresAt: organization.subscription_expires_at,
            pendingChange: serializeChange(openChange)
        },
        payments: payments.map(serializePayment),
        eventPasses: eventPasses.map((pass) => ({
            id: pass.event_pass_id,
            status: pass.status,
            purchasedAt: pass.purchased_at,
            activatedAt: pass.activated_at,
            expiresAt: pass.expires_at,
            event: pass.event ? { id: pass.event.event_id, title: pass.event.title } : null
        }))
    };
};

const startProTrial = async (orgId) => {
    if (process.env.ENABLE_PRO_TRIAL !== "true") {
        throw new PaymentValidationError("L’essai Pro n’est pas proposé actuellement.", "TRIAL_NOT_OFFERED");
    }
    if (!orgId) {
        throw new PaymentValidationError("Organisation introuvable.", "ORGANIZATION_NOT_FOUND");
    }

    const [organization, proPlan] = await Promise.all([
        prisma.organization.findUnique({
            where: { org_id: orgId },
            include: { plan: true }
        }),
        getPlanByKey(prisma, PLAN_KEYS.PRO)
    ]);

    if (!organization || organization.deleted_at || !organization.is_active) {
        throw new PaymentValidationError("Organisation inactive ou introuvable.", "ORGANIZATION_NOT_FOUND");
    }
    if (organization.trial_started_at) {
        throw new PaymentValidationError(
            "L’essai Pro a déjà été utilisé par cette organisation.",
            "TRIAL_ALREADY_USED"
        );
    }
    const currentSummary = getPlanSummary(organization);
    if (currentSummary.isPaid) {
        throw new PaymentValidationError(
            "Un abonnement payant est déjà actif pour cette organisation.",
            "PAID_SUBSCRIPTION_ALREADY_ACTIVE"
        );
    }
    if (!proPlan) {
        throw new PaymentValidationError("Le plan Pro est indisponible.", "PRO_PLAN_NOT_FOUND");
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + getTrialDurationDays());

    const openChange = await prisma.subscriptionChange.findFirst({
        where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } }
    });
    if (openChange) {
        throw new PaymentValidationError(
            "Terminez ou annulez d’abord le changement d’abonnement en cours.",
            "SUBSCRIPTION_CHANGE_IN_PROGRESS"
        );
    }

    const activation = await prisma.$transaction(async (tx) => {
        const updated = await tx.organization.updateMany({
            where: {
                org_id: orgId,
                deleted_at: null,
                is_active: true,
                trial_started_at: null
            },
            data: {
                subscription_plan: proPlan.plan_id,
                subscription_started_at: now,
                subscription_expires_at: expiresAt,
                subscription_interval: BILLING_INTERVALS.MONTHLY,
                trial_started_at: now,
                trial_expires_at: expiresAt
            }
        });
        if (updated.count !== 1) return updated;
        await tx.subscription.upsert({
            where: { org_id: orgId },
            update: {
                plan_id: proPlan.plan_id,
                status: "TRIALING",
                billing_interval: BILLING_INTERVALS.MONTHLY,
                current_period_start: now,
                current_period_end: expiresAt,
                cancel_at_period_end: false,
                version: { increment: 1 }
            },
            create: {
                org_id: orgId,
                plan_id: proPlan.plan_id,
                status: "TRIALING",
                billing_interval: BILLING_INTERVALS.MONTHLY,
                current_period_start: now,
                current_period_end: expiresAt
            }
        });
        await tx.subscriptionPeriod.create({
            data: {
                org_id: orgId,
                plan_id: proPlan.plan_id,
                billing_interval: BILLING_INTERVALS.MONTHLY,
                starts_at: now,
                ends_at: expiresAt,
                source: "TRIAL",
                entitlement_snapshot: planSnapshot(PLAN_KEYS.PRO)
            }
        });
        return updated;
    });

    if (activation.count !== 1) {
        throw new PaymentValidationError(
            "L’essai Pro a déjà été activé ou l’organisation n’est plus disponible.",
            "TRIAL_NOT_AVAILABLE"
        );
    }

    const updatedOrganization = await prisma.organization.findUnique({
        where: { org_id: orgId },
        include: { plan: true }
    });
    logger.info("subscription.trial_started", {
        org_id: orgId,
        expires_at: expiresAt
    });
    return getPlanSummary(updatedOrganization);
};

const requestCancellation = async (orgId) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`);
    const organization = await tx.organization.findUnique({
        where: { org_id: orgId },
        include: { plan: true }
    });
    if (!organization || !getPlanSummary(organization).isPaid || !organization.subscription_expires_at) {
        throw new PaymentValidationError("Aucun abonnement payant actif ne peut être annulé.", "NO_ACTIVE_PAID_SUBSCRIPTION");
    }
    const open = await tx.subscriptionChange.findFirst({
        where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } }
    });
    if (open) {
        throw new PaymentValidationError("Un changement d’abonnement est déjà en cours.", "SUBSCRIPTION_CHANGE_IN_PROGRESS");
    }
    const subscription = await ensureSubscription(tx, organization);
    const discovery = await getPlanByKey(tx, PLAN_KEYS.DISCOVERY);
    const change = await tx.subscriptionChange.create({
        data: {
            org_id: orgId,
            subscription_id: subscription.subscription_id,
            from_plan_id: organization.subscription_plan,
            to_plan_id: discovery.plan_id,
            from_interval: organization.subscription_interval,
            type: "CANCEL",
            status: "SCHEDULED",
            effective_at: organization.subscription_expires_at,
            source_version: subscription.version
        },
        include: { from_plan: true, to_plan: true }
    });
    await tx.subscription.update({
        where: { subscription_id: subscription.subscription_id },
        data: { cancel_at_period_end: true }
    });
    await recordSubscriptionAudit(tx, {
        org_id: orgId,
        action: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
        before_snapshot: { planId: organization.subscription_plan, expiresAt: organization.subscription_expires_at },
        after_snapshot: { planId: discovery.plan_id, effectiveAt: organization.subscription_expires_at }
    });
    return serializeChange(change);
});

const cancelOpenChange = async (orgId) => {
    const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`);
        const change = await tx.subscriptionChange.findFirst({
            where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } },
            include: { payment: true, from_plan: true, to_plan: true },
            orderBy: { created_at: "desc" }
        });
        if (!change) {
            throw new PaymentValidationError("Aucun changement d’abonnement n’est en cours.", "NO_SUBSCRIPTION_CHANGE");
        }
        if (change.status === "REFUND_PENDING") {
            throw new PaymentValidationError("Le remboursement est déjà en cours.", "REFUND_ALREADY_PENDING");
        }
        if (change.status === "SCHEDULED" && change.payment?.status === "COMPLETED") {
            const refund = await tx.refund.create({
                data: {
                    provider_refund_id: crypto.randomUUID(),
                    payment_id: change.payment.payment_id,
                    org_id: orgId,
                    reason: "CANCELED_SCHEDULED_SUBSCRIPTION_CHANGE"
                }
            });
            const pending = await tx.subscriptionChange.update({
                where: { subscription_change_id: change.subscription_change_id },
                data: { status: "REFUND_PENDING", reason: "REFUND_REQUESTED_BY_CUSTOMER" },
                include: { from_plan: true, to_plan: true }
            });
            await tx.payment.update({
                where: { payment_id: change.payment.payment_id },
                data: { status: "REFUND_PENDING" }
            });
            return { change: pending, refund, depositId: change.payment.deposit_id };
        }
        const canceled = await tx.subscriptionChange.update({
            where: { subscription_change_id: change.subscription_change_id },
            data: { status: "CANCELED", canceled_at: new Date(), reason: "CANCELED_BY_CUSTOMER" },
            include: { from_plan: true, to_plan: true }
        });
        if (change.subscription_id) {
            await tx.subscription.update({
                where: { subscription_id: change.subscription_id },
                data: { cancel_at_period_end: false }
            });
        }
        return { change: canceled, refund: null };
    });

    if (!result.refund) return serializeChange(result.change);
    try {
        const response = await pawaPay.initiateRefund({
            refundId: result.refund.provider_refund_id,
            depositId: result.depositId
        });
        const accepted = ["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status);
        await prisma.refund.update({
            where: { refund_id: result.refund.refund_id },
            data: accepted ? {
                status: response?.status === "PROCESSING" ? "PROCESSING" : "PENDING",
                provider_payload: response
            } : {
                status: "FAILED",
                failure_code: response?.failureReason?.failureCode || response?.status || "REJECTED",
                failure_message: response?.failureReason?.failureMessage || "Le remboursement a été rejeté.",
                provider_payload: response
            }
        });
        if (!accepted) {
            await prisma.$transaction([
                prisma.subscriptionChange.update({
                    where: { subscription_change_id: result.change.subscription_change_id },
                    data: { status: "SCHEDULED", reason: "REFUND_REJECTED" }
                }),
                prisma.payment.update({
                    where: { payment_id: result.refund.payment_id },
                    data: { status: "COMPLETED" }
                })
            ]);
            throw new PaymentValidationError(
                "Le remboursement a été rejeté. Le changement reste programmé.",
                "REFUND_REJECTED"
            );
        }
        return serializeChange(result.change);
    } catch (error) {
        if (error instanceof PaymentValidationError) throw error;
        logger.error("refund.initiation_uncertain", {
            refund_id: result.refund.refund_id,
            payment_id: result.refund.payment_id,
            org_id: orgId,
            error
        });
        return serializeChange(result.change);
    }
};

const selectRetainedResources = async (orgId, { agentIds = [], areaIds = [] } = {}) => {
    const normalizedAgentIds = [...new Set(agentIds.map(Number).filter(Number.isInteger))];
    const normalizedAreaIds = [...new Set(areaIds.map(Number).filter(Number.isInteger))];
    const change = await prisma.subscriptionChange.findFirst({
        where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } },
        include: { to_plan: true, from_plan: true },
        orderBy: { created_at: "desc" }
    });
    if (!change || !["DOWNGRADE", "INTERVAL_CHANGE"].includes(change.type)) {
        throw new PaymentValidationError("Aucun downgrade ne nécessite une sélection de ressources.", "NO_DOWNGRADE_RESOURCE_SELECTION");
    }
    const targetKey = change.to_plan?.title;
    const details = PLAN_DETAILS[targetKey] || PLAN_DETAILS.DISCOVERY;
    if (details.maxAgents != null && normalizedAgentIds.length > details.maxAgents) {
        throw new PaymentValidationError(`Vous pouvez conserver au maximum ${details.maxAgents} agents actifs.`, "TOO_MANY_RETAINED_AGENTS");
    }
    if (details.maxAreas != null && normalizedAreaIds.length > details.maxAreas) {
        throw new PaymentValidationError(`Vous pouvez conserver au maximum ${details.maxAreas} zones actives.`, "TOO_MANY_RETAINED_AREAS");
    }
    const [agents, areas] = await Promise.all([
        prisma.userQ.count({
            where: {
                user_id: { in: normalizedAgentIds },
                org_id: orgId,
                role: { in: ["ORG_AGENT", "OPERATOR"] },
                deleted_at: null,
                is_active: true
            }
        }),
        prisma.area.count({
            where: { area_id: { in: normalizedAreaIds }, org_id: orgId, deleted_at: null, suspended_by_plan: false }
        })
    ]);
    if (agents !== normalizedAgentIds.length || areas !== normalizedAreaIds.length) {
        throw new PaymentValidationError("Une ressource sélectionnée est inactive ou appartient à une autre organisation.", "INVALID_RETAINED_RESOURCE");
    }
    const updated = await prisma.subscriptionChange.update({
        where: { subscription_change_id: change.subscription_change_id },
        data: { resource_selection: { agentIds: normalizedAgentIds, areaIds: normalizedAreaIds } },
        include: { from_plan: true, to_plan: true }
    });
    return serializeChange(updated);
};

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

const findProvider = async (providerCode, countryCode, currencyCode) => {
    const providers = await getProviders();
    return selectProviderConfiguration(providers, providerCode, countryCode, currencyCode);
};

const getPaymentQuote = async ({ orgId, planKey, billingInterval, providerCode, countryCode, currencyCode }) => {
    const normalizedPlan = String(planKey || "").trim().toUpperCase();
    if (![PLAN_KEYS.ESSENTIAL, PLAN_KEYS.PRO, PLAN_KEYS.EVENT_PASS].includes(normalizedPlan)) {
        throw new PaymentValidationError("Ce produit ne peut pas être acheté.", "PLAN_NOT_PURCHASABLE");
    }
    const normalizedInterval = String(billingInterval || (
        normalizedPlan === PLAN_KEYS.EVENT_PASS ? BILLING_INTERVALS.ONE_TIME : BILLING_INTERVALS.MONTHLY
    )).trim().toUpperCase();
    const allowed = normalizedPlan === PLAN_KEYS.ESSENTIAL
        ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
        : normalizedPlan === PLAN_KEYS.PRO
            ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
            : [BILLING_INTERVALS.ONE_TIME];
    if (!allowed.includes(normalizedInterval)) {
        throw new PaymentValidationError("Cette périodicité n’est pas disponible pour ce produit.", "BILLING_INTERVAL_NOT_AVAILABLE");
    }
    const [organization, plan, provider] = await Promise.all([
        prisma.organization.findUnique({ where: { org_id: orgId }, include: { plan: true } }),
        getPlanByKey(prisma, normalizedPlan),
        findProvider(providerCode, countryCode, currencyCode)
    ]);
    if (!organization || organization.deleted_at || !organization.is_active || !plan) {
        throw new PaymentValidationError("Organisation ou plan introuvable.", "ORGANIZATION_NOT_FOUND");
    }
    const quote = calculatePaymentQuote({
        organization,
        plan,
        provider,
        billingInterval: normalizedInterval
    });
    return {
        plan: normalizedPlan,
        billingInterval: normalizedInterval,
        reason: buildPaymentReason({
            planKey: normalizedPlan,
            billingInterval: normalizedInterval,
            transitionType: quote.transition?.type
        }),
        amount: String(quote.localPrice),
        currency: provider.currency,
        referenceAmount: String(quote.referencePrice),
        referenceCurrency: plan.currency,
        creditAmount: String(quote.creditAmount),
        transition: quote.transition ? {
            type: quote.transition.type,
            effectiveAt: quote.transition.effectiveAt,
            prorated: quote.transition.prorated
        } : null
    };
};

const initiatePayment = async ({ orgId, userId, planKey, billingInterval, providerCode, countryCode, currencyCode, phoneNumber }) => {
    const paymentConfig = getPaymentConfig();
    if (!paymentConfig.enabled) {
        throw new PaymentValidationError(
            "Les paiements sont temporairement indisponibles.",
            "PAYMENTS_DISABLED"
        );
    }

    const normalizedPlan = String(planKey || "").trim().toUpperCase();
    if (![PLAN_KEYS.ESSENTIAL, PLAN_KEYS.PRO, PLAN_KEYS.EVENT_PASS].includes(normalizedPlan)) {
        throw new PaymentValidationError("Ce produit ne peut pas être acheté.", "PLAN_NOT_PURCHASABLE");
    }
    const defaultInterval = normalizedPlan === PLAN_KEYS.EVENT_PASS
        ? BILLING_INTERVALS.ONE_TIME
        : BILLING_INTERVALS.MONTHLY;
    const normalizedInterval = String(billingInterval || defaultInterval).trim().toUpperCase();
    const allowedIntervals = normalizedPlan === PLAN_KEYS.ESSENTIAL
        ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
        : normalizedPlan === PLAN_KEYS.PRO
            ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
            : [BILLING_INTERVALS.ONE_TIME];
    if (!allowedIntervals.includes(normalizedInterval)) {
        throw new PaymentValidationError("Cette périodicité n’est pas disponible pour ce produit.", "BILLING_INTERVAL_NOT_AVAILABLE");
    }

    const [organization, plan, provider] = await Promise.all([
        prisma.organization.findUnique({ where: { org_id: orgId }, include: { plan: true } }),
        getPlanByKey(prisma, normalizedPlan),
        findProvider(providerCode, countryCode, currencyCode)
    ]);
    if (!organization || organization.deleted_at || !organization.is_active) {
        throw new PaymentValidationError("Organisation inactive ou introuvable.", "ORGANIZATION_NOT_FOUND");
    }
    if (!plan || plan.cost <= 0) {
        throw new PaymentValidationError("Le tarif du plan est invalide.", "INVALID_PLAN_PRICE");
    }
    const normalizedPhone = normalizePhoneNumber(phoneNumber, {
        country: provider.country,
        prefix: provider.prefix
    });
    const now = new Date();
    const { transition, localPrice, referencePrice } = calculatePaymentQuote({
        organization,
        plan,
        provider,
        billingInterval: normalizedInterval,
        now
    });

    const depositId = crypto.randomUUID();
    let payment;
    try {
        payment = await prisma.$transaction(async (tx) => {
            let subscriptionChangeId = null;
            if (normalizedPlan !== PLAN_KEYS.EVENT_PASS) {
                await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`);
                const openChange = await tx.subscriptionChange.findFirst({
                    where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } }
                });
                if (openChange) {
                    throw new PaymentValidationError(
                        "Un changement d’abonnement est déjà en cours. Terminez-le avant d’en démarrer un autre.",
                        "SUBSCRIPTION_CHANGE_IN_PROGRESS"
                    );
                }
                const subscription = await ensureSubscription(tx, organization);
                const change = await tx.subscriptionChange.create({
                    data: {
                        org_id: orgId,
                        subscription_id: subscription.subscription_id,
                        from_plan_id: organization.subscription_plan,
                        to_plan_id: plan.plan_id,
                        from_interval: organization.subscription_interval,
                        to_interval: normalizedInterval,
                        type: transition.type,
                        status: "AWAITING_PAYMENT",
                        effective_at: transition.effectiveAt,
                        quoted_amount: new Prisma.Decimal(localPrice),
                        quoted_currency: provider.currency,
                        reference_amount: new Prisma.Decimal(referencePrice),
                        reference_currency: plan.currency,
                        source_version: subscription.version
                    }
                });
                subscriptionChangeId = change.subscription_change_id;
            }
            return tx.payment.create({
                data: {
                    deposit_id: depositId,
                    org_id: orgId,
                    plan_id: plan.plan_id,
                    initiated_by_id: userId,
                    amount: new Prisma.Decimal(localPrice),
                    currency: provider.currency,
                    reference_amount: new Prisma.Decimal(referencePrice),
                    reference_currency: plan.currency,
                    country: provider.country,
                    provider: provider.provider,
                    phone_number: normalizedPhone,
                    billing_interval: normalizedInterval,
                    subscription_change_id: subscriptionChangeId
                },
                include: {
                    plan: true,
                    subscription_change: { include: { from_plan: true, to_plan: true } }
                }
            });
        });
    } catch (error) {
        if (error?.code === "P2002") {
            throw new PaymentValidationError(
                "Un changement d’abonnement est déjà en cours.",
                "SUBSCRIPTION_CHANGE_IN_PROGRESS"
            );
        }
        throw error;
    }

    const payload = {
        depositId,
        amount: String(localPrice),
        currency: provider.currency,
        payer: {
            type: "MMO",
            accountDetails: {
                phoneNumber: normalizedPhone,
                provider: provider.provider
            }
        },
        clientReferenceId: `ACCESSQ-${payment.payment_id}`,
        customerMessage: buildProviderCustomerMessage({
            planKey: normalizedPlan,
            billingInterval: normalizedInterval,
            transitionType: transition?.type
        }),
        metadata: [
            { organizationId: String(orgId), isPII: false },
            { plan: plan.title, isPII: false },
            { billingInterval: normalizedInterval, isPII: false },
            {
                paymentReason: buildPaymentReason({
                    planKey: normalizedPlan,
                    billingInterval: normalizedInterval,
                    transitionType: transition?.type
                }),
                isPII: false
            },
            { referencePrice: `${referencePrice} ${plan.currency}`, isPII: false }
        ]
    };

    try {
        const response = await pawaPay.initiateDeposit(payload);
        const accepted = ["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status);
        const rawFailure = extractPawaPayFailure(response);
        if (!accepted) {
            logger.warn("payment.pawapay_rejected", {
                payment_id: payment.payment_id,
                deposit_id: depositId,
                org_id: orgId,
                pawapay_failure_code: rawFailure.code,
                pawapay_failure_message: rawFailure.message
            });
        }
        const updated = await prisma.payment.update({
            where: { payment_id: payment.payment_id },
            data: accepted
                ? {
                    status: response?.status === "PROCESSING" ? "PROCESSING" : "PENDING",
                    provider_payload: response
                }
                : {
                    status: "FAILED",
                    failure_code: rawFailure.code || "REJECTED",
                    failure_message: rawFailure.message || rawFailure.code || "REJECTED",
                    provider_payload: response
                },
            include: {
                plan: true,
                subscription_change: { include: { from_plan: true, to_plan: true } }
            }
        });
        if (!accepted && payment.subscription_change_id) {
            await prisma.subscriptionChange.update({
                where: { subscription_change_id: payment.subscription_change_id },
                data: { status: "FAILED", reason: updated.failure_code }
            });
        }
        return serializePayment(updated);
    } catch (error) {
        const rawFailure = extractPawaPayFailure(error.responseData);
        logger.error("payment.initiation_uncertain", {
            payment_id: payment.payment_id,
            deposit_id: depositId,
            org_id: orgId,
            pawapay_failure_code: rawFailure.code,
            pawapay_failure_message: rawFailure.message,
            error
        });
        error.payment = serializePayment(payment);
        throw error;
    }
};

const unwrapDepositStatus = (response) => {
    if (response?.status === "FOUND" && response.data) return response.data;
    if (response?.depositId) return response;
    return null;
};

const amountsMatch = (expected, received) => {
    try {
        return new Prisma.Decimal(expected).equals(new Prisma.Decimal(received));
    } catch {
        return false;
    }
};

const reconcileRefund = async (providerRefundId) => {
    const existing = await prisma.refund.findUnique({
        where: { provider_refund_id: providerRefundId },
        include: { payment: { include: { subscription_change: true } } }
    });
    if (!existing) return null;
    if (["COMPLETED", "FAILED"].includes(existing.status)) return existing;

    const response = await pawaPay.checkRefund(providerRefundId);
    const remote = response?.status === "FOUND" && response.data ? response.data : response;
    if (!remote || (remote.refundId && remote.refundId !== providerRefundId)) return existing;
    if (remote.status === "COMPLETED") {
        return prisma.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${existing.org_id} FOR UPDATE`);
            const refund = await tx.refund.update({
                where: { refund_id: existing.refund_id },
                data: {
                    status: "COMPLETED",
                    provider_transaction_id: remote.providerTransactionId || null,
                    provider_payload: remote,
                    failure_code: null,
                    failure_message: null,
                    completed_at: new Date()
                }
            });
            await tx.payment.update({
                where: { payment_id: existing.payment_id },
                data: { status: "REFUNDED" }
            });
            const change = existing.payment.subscription_change;
            if (change) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: change.subscription_change_id },
                    data: { status: "CANCELED", canceled_at: new Date(), reason: "PAYMENT_REFUNDED" }
                });
                if (change.subscription_id) {
                    await tx.subscription.update({
                        where: { subscription_id: change.subscription_id },
                        data: { cancel_at_period_end: false }
                    });
                }
            }
            return refund;
        });
    }
    if (remote.status === "FAILED") {
        const failure = remote.failureReason || {};
        await prisma.$transaction(async (tx) => {
            await tx.refund.update({
                where: { refund_id: existing.refund_id },
                data: {
                    status: "FAILED",
                    failure_code: failure.failureCode || "FAILED",
                    failure_message: failure.failureMessage || "Le remboursement a échoué.",
                    provider_payload: remote
                }
            });
            await tx.payment.update({
                where: { payment_id: existing.payment_id },
                data: { status: "COMPLETED" }
            });
            if (existing.payment.subscription_change) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: existing.payment.subscription_change.subscription_change_id },
                    data: { status: "SCHEDULED", reason: "REFUND_FAILED" }
                });
            }
        });
    } else {
        await prisma.refund.update({
            where: { refund_id: existing.refund_id },
            data: { status: "PROCESSING", provider_payload: remote }
        });
    }
    return prisma.refund.findUnique({ where: { provider_refund_id: providerRefundId } });
};

const reconcilePayment = async (depositId) => {
    if (!arePaymentsEnabled()) {
        throw new PaymentValidationError(
            "Les paiements sont temporairement indisponibles.",
            "PAYMENTS_DISABLED"
        );
    }

    const existing = await prisma.payment.findUnique({
        where: { deposit_id: depositId },
        include: {
            plan: true,
            subscription_change: { include: { from_plan: true, to_plan: true } }
        }
    });
    if (!existing) return null;
    if (["COMPLETED", "REFUNDED", "REVIEW_REQUIRED"].includes(existing.status)) return serializePayment(existing);

    const statusResponse = await pawaPay.checkDeposit(depositId);
    const remote = unwrapDepositStatus(statusResponse);
    if (!remote) return serializePayment(existing);
    if (
        remote.depositId !== existing.deposit_id
        || !amountsMatch(existing.amount, remote.amount)
        || remote.currency !== existing.currency
        || (remote.country && remote.country !== existing.country)
        || (
            remote.payer?.accountDetails?.provider
            && remote.payer.accountDetails.provider !== existing.provider
        )
        || (
            remote.payer?.accountDetails?.phoneNumber
            && remote.payer.accountDetails.phoneNumber !== existing.phone_number
        )
    ) {
        logger.error("payment.reconciliation_mismatch", {
            payment_id: existing.payment_id,
            deposit_id: depositId,
            org_id: existing.org_id
        });
        throw new PaymentValidationError(
            "Les données du paiement ne correspondent pas à la transaction attendue.",
            "PAYMENT_RECONCILIATION_MISMATCH"
        );
    }

    if (remote.status === "COMPLETED") {
        const completed = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw(
                Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${existing.org_id} FOR UPDATE`
            );
            const current = await tx.payment.findUnique({
                where: { payment_id: existing.payment_id },
                include: {
                    plan: true,
                    subscription_change: { include: { from_plan: true, to_plan: true } }
                }
            });
            if (current.status === "COMPLETED") return current;

            const now = new Date();
            if (current.plan.title === PLAN_KEYS.EVENT_PASS) {
                await tx.eventPass.create({
                    data: {
                        org_id: current.org_id,
                        payment_id: current.payment_id,
                        status: "AVAILABLE"
                    }
                });
                return tx.payment.update({
                    where: { payment_id: current.payment_id },
                    data: {
                        status: "COMPLETED",
                        provider_transaction_id: remote.providerTransactionId || null,
                        failure_code: null,
                        failure_message: null,
                        access_starts_at: null,
                        access_expires_at: null,
                        completed_at: now,
                        provider_payload: remote
                    },
                    include: { plan: true }
                });
            }

            const organization = await tx.organization.findUnique({
                where: { org_id: existing.org_id },
                include: { plan: true }
            });
            const subscription = await ensureSubscription(tx, organization);
            let change = current.subscription_change;
            if (!change) {
                const legacyTransition = classifyChange({
                    organization,
                    targetPlan: current.plan.title,
                    targetInterval: current.billing_interval,
                    now
                });
                change = await tx.subscriptionChange.create({
                    data: {
                        org_id: current.org_id,
                        subscription_id: subscription.subscription_id,
                        from_plan_id: organization.subscription_plan,
                        to_plan_id: current.plan_id,
                        from_interval: organization.subscription_interval,
                        to_interval: current.billing_interval,
                        type: legacyTransition.type,
                        status: "AWAITING_PAYMENT",
                        effective_at: legacyTransition.effectiveAt,
                        quoted_amount: current.amount,
                        quoted_currency: current.currency,
                        reference_amount: current.reference_amount,
                        reference_currency: current.reference_currency,
                        source_version: subscription.version,
                        payment: { connect: { payment_id: current.payment_id } }
                    },
                    include: { from_plan: true, to_plan: true }
                });
            }

            if (change.status !== "AWAITING_PAYMENT" || subscription.version !== change.source_version) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: change.subscription_change_id },
                    data: {
                        status: "REVIEW_REQUIRED",
                        reason: change.status !== "AWAITING_PAYMENT"
                            ? `PAYMENT_COMPLETED_AFTER_${change.status}`
                            : "SUBSCRIPTION_VERSION_CHANGED"
                    }
                });
                return tx.payment.update({
                    where: { payment_id: current.payment_id },
                    data: {
                        status: "REVIEW_REQUIRED",
                        provider_transaction_id: remote.providerTransactionId || null,
                        completed_at: now,
                        provider_payload: remote
                    },
                    include: { plan: true, subscription_change: true }
                });
            }

            const scheduled = change.effective_at && change.effective_at > now
                && ["DOWNGRADE", "INTERVAL_CHANGE"].includes(change.type);
            const scheduledExpiresAt = scheduled
                ? addUtcMonths(change.effective_at, change.to_interval === BILLING_INTERVALS.ANNUAL ? 12 : 1)
                : null;
            if (scheduled) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: change.subscription_change_id },
                    data: { status: "SCHEDULED" }
                });
                return tx.payment.update({
                    where: { payment_id: current.payment_id },
                    data: {
                        status: "COMPLETED",
                        provider_transaction_id: remote.providerTransactionId || null,
                        failure_code: null,
                        failure_message: null,
                        access_starts_at: change.effective_at,
                        access_expires_at: scheduledExpiresAt,
                        completed_at: now,
                        provider_payload: remote
                    },
                    include: { plan: true, subscription_change: { include: { from_plan: true, to_plan: true } } }
                });
            }

            const currentExpiry = organization.subscription_expires_at
                ? new Date(organization.subscription_expires_at)
                : null;
            const renewal = change.type === "RENEWAL" && currentExpiry && currentExpiry > now;
            const upgrade = change.type === "UPGRADE" && currentExpiry && currentExpiry > now;
            const startsAt = renewal ? currentExpiry : now;
            const expiresAt = upgrade
                ? currentExpiry
                : addUtcMonths(startsAt, current.billing_interval === BILLING_INTERVALS.ANNUAL ? 12 : 1);
            const subscriptionStartedAt = renewal || upgrade
                ? organization.subscription_started_at || now
                : now;

            await tx.organization.update({
                where: { org_id: existing.org_id },
                data: {
                    subscription_plan: existing.plan_id,
                    subscription_started_at: subscriptionStartedAt,
                    subscription_expires_at: expiresAt,
                    subscription_interval: current.billing_interval,
                    trial_expires_at: organization.trial_expires_at && new Date(organization.trial_expires_at) <= now
                        ? null
                        : organization.trial_expires_at
                }
            });
            await tx.subscription.update({
                where: { subscription_id: subscription.subscription_id },
                data: {
                    plan_id: current.plan_id,
                    status: "ACTIVE",
                    billing_interval: current.billing_interval,
                    current_period_start: subscriptionStartedAt,
                    current_period_end: expiresAt,
                    cancel_at_period_end: false,
                    version: { increment: 1 }
                }
            });
            await tx.subscriptionPeriod.create({
                data: {
                    org_id: current.org_id,
                    plan_id: current.plan_id,
                    payment_id: current.payment_id,
                    billing_interval: current.billing_interval,
                    starts_at: startsAt,
                    ends_at: expiresAt,
                    source: change.type,
                    entitlement_snapshot: planSnapshot(current.plan.title)
                }
            });
            await recordSubscriptionAudit(tx, {
                org_id: current.org_id,
                actor_user_id: current.initiated_by_id,
                action: `SUBSCRIPTION_CHANGE_${change.type}_APPLIED`,
                before_snapshot: { planId: change.from_plan_id, interval: change.from_interval },
                after_snapshot: { planId: current.plan_id, interval: current.billing_interval, startsAt, expiresAt }
            });
            await tx.subscriptionChange.update({
                where: { subscription_change_id: change.subscription_change_id },
                data: { status: "APPLIED", applied_at: now }
            });
            return tx.payment.update({
                where: { payment_id: existing.payment_id },
                data: {
                    status: "COMPLETED",
                    provider_transaction_id: remote.providerTransactionId || null,
                    failure_code: null,
                    failure_message: null,
                    access_starts_at: startsAt,
                    access_expires_at: expiresAt,
                    completed_at: now,
                    provider_payload: remote
                },
                include: {
                    plan: true,
                    subscription_change: { include: { from_plan: true, to_plan: true } }
                }
            });
        });

        logger.info("payment.completed", {
            payment_id: completed.payment_id,
            deposit_id: depositId,
            org_id: completed.org_id
        });
        return serializePayment(completed);
    }

    const failure = remote.failureReason || {};
    if (remote.status === "FAILED") {
        logger.warn("payment.pawapay_failed", {
            payment_id: existing.payment_id,
            deposit_id: depositId,
            org_id: existing.org_id,
            pawapay_failure_code: failure.failureCode || "FAILED",
            pawapay_failure_message: failure.failureMessage || null
        });
    }
    const updated = await prisma.payment.update({
        where: { payment_id: existing.payment_id },
        data: {
            status: remote.status === "FAILED" ? "FAILED" : "PROCESSING",
            provider_transaction_id: remote.providerTransactionId || null,
            failure_code: remote.status === "FAILED" ? failure.failureCode || "FAILED" : null,
            failure_message: remote.status === "FAILED"
                ? failure.failureMessage || failure.failureCode || "FAILED"
                : null,
            provider_payload: remote
        },
        include: {
            plan: true,
            subscription_change: { include: { from_plan: true, to_plan: true } }
        }
    });
    if (remote.status === "FAILED" && existing.subscription_change_id) {
        await prisma.subscriptionChange.update({
            where: { subscription_change_id: existing.subscription_change_id },
            data: { status: "FAILED", reason: failure.failureCode || "FAILED" }
        });
    }
    return serializePayment(updated);
};

const reconcilePendingTransactions = async (now = new Date()) => {
    if (!arePaymentsEnabled()) return { payments: 0, refunds: 0 };
    const retryBefore = new Date(now.getTime() - 2 * 60 * 1000);
    const expireBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [payments, refunds] = await Promise.all([
        prisma.payment.findMany({
            where: { status: { in: ["PENDING", "PROCESSING"] }, created_at: { lte: retryBefore } },
            select: { payment_id: true, deposit_id: true, created_at: true, subscription_change_id: true },
            orderBy: { created_at: "asc" },
            take: 50
        }),
        prisma.refund.findMany({
            where: { status: { in: ["PENDING", "PROCESSING"] }, created_at: { lte: retryBefore } },
            select: { provider_refund_id: true },
            orderBy: { created_at: "asc" },
            take: 50
        })
    ]);
    for (const payment of payments) {
        try {
            const result = await reconcilePayment(payment.deposit_id);
            if (payment.created_at <= expireBefore && ["PENDING", "PROCESSING"].includes(result?.status)) {
                await prisma.$transaction(async (tx) => {
                    await tx.payment.update({
                        where: { payment_id: payment.payment_id },
                        data: { status: "EXPIRED", failure_code: "PAYMENT_EXPIRED", failure_message: "La demande de paiement a expiré." }
                    });
                    if (payment.subscription_change_id) {
                        await tx.subscriptionChange.update({
                            where: { subscription_change_id: payment.subscription_change_id },
                            data: { status: "EXPIRED", reason: "PAYMENT_EXPIRED" }
                        });
                    }
                });
            }
        } catch (error) {
            const rawFailure = extractPawaPayFailure(error.responseData);
            logger.warn("payment.background_reconciliation_failed", {
                deposit_id: payment.deposit_id,
                pawapay_failure_code: rawFailure.code,
                pawapay_failure_message: rawFailure.message,
                error
            });
        }
    }
    for (const refund of refunds) {
        try {
            await reconcileRefund(refund.provider_refund_id);
        } catch (error) {
            logger.warn("refund.background_reconciliation_failed", { refund_id: refund.provider_refund_id, error });
        }
    }
    return { payments: payments.length, refunds: refunds.length };
};

module.exports = {
    PaymentValidationError,
    arePaymentsEnabled,
    normalizePhoneNumber,
    buildPaymentReason,
    buildProviderCustomerMessage,
    extractPawaPayFailure,
    publicPaymentFailureMessage,
    serializePayment,
    getProviders,
    getPlans,
    getBillingOverview,
    getPaymentQuote,
    startProTrial,
    requestCancellation,
    cancelOpenChange,
    selectRetainedResources,
    initiatePayment,
    reconcilePayment,
    reconcileRefund,
    reconcilePendingTransactions,
    applyDueSubscriptionChanges,
    subscriptionPolicy: {
        classifyChange,
        getRemainingMonthlyUnits,
        getRemainingPeriodUnits,
        roundForProvider,
        calculatePaymentQuote,
        selectProviderConfiguration
    }
};
