// Catalogue des plans et des opérateurs pawaPay disponibles.
const prisma = require("../../prisma/client");
const pawaPay = require("../pawapay.service");
const { getPaymentConfig } = require("../../config/payment");
const {
    PLAN_KEYS,
    BILLING_INTERVALS,
    PLAN_DETAILS,
    ensureDefaultPlans,
    getFixedPlanPrice
} = require("../../config/subscription");
const { selectProviderConfiguration } = require("./policy");

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

const findProvider = async (providerCode, countryCode, currencyCode) => {
    const providers = await getProviders();
    return selectProviderConfiguration(providers, providerCode, countryCode, currencyCode);
};

module.exports = {
    getProviders,
    getPlans,
    findProvider
};
