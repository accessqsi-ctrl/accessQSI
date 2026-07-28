const DEFAULT_PAYMENT_CURRENCY = "USD";
const DEFAULT_SUBSCRIPTION_DAYS = 30;

const positiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const customerMessage = (value) => {
    const normalized = String(value || "ACCESSQ PRO")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 22);
    return normalized.length >= 4 ? normalized : "ACCESSQ PRO";
};

const enabled = (value) => String(value || "false").trim().toLowerCase() === "true";

const getPaymentConfig = (env = process.env) => ({
    enabled: enabled(env.PRO_PAYMENTS_ENABLED),
    currency: String(env.PAWAPAY_CURRENCY || DEFAULT_PAYMENT_CURRENCY).trim().toUpperCase(),
    country: String(env.PAWAPAY_COUNTRY || "").trim().toUpperCase() || null,
    subscriptionDays: positiveInteger(env.PRO_SUBSCRIPTION_DAYS, DEFAULT_SUBSCRIPTION_DAYS),
    customerMessage: customerMessage(env.PAWAPAY_CUSTOMER_MESSAGE),
    providerAllowlist: String(env.PAWAPAY_PROVIDERS || "")
        .split(",")
        .map((provider) => provider.trim().toUpperCase())
        .filter(Boolean)
});

module.exports = {
    DEFAULT_PAYMENT_CURRENCY,
    DEFAULT_SUBSCRIPTION_DAYS,
    getPaymentConfig
};
