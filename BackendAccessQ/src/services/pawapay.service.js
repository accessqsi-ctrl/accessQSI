const axios = require("axios");
const { getPaymentConfig } = require("../config/payment");

class PawaPayConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "PawaPayConfigurationError";
        this.code = "PAWAPAY_NOT_CONFIGURED";
    }
}

class PawaPayRequestError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = "PawaPayRequestError";
        this.code = "PAWAPAY_REQUEST_FAILED";
        this.status = options.status;
        this.responseData = options.responseData;
        this.cause = options.cause;
    }
}

const getClientConfig = (env = process.env) => {
    const sandbox = String(env.PAWAPAY_ENVIRONMENT || "sandbox").toLowerCase() !== "production";
    const baseURL = env.PAWAPAY_BASE_URL
        || (sandbox ? "https://api.sandbox.pawapay.io" : "https://api.pawapay.io");
    const apiToken = String(env.PAWAPAY_API_TOKEN || "").trim();

    if (!apiToken) {
        throw new PawaPayConfigurationError("Le jeton API pawaPay n'est pas configuré.");
    }

    return {
        baseURL: baseURL.replace(/\/+$/, ""),
        apiToken,
        timeout: Number.parseInt(env.PAWAPAY_TIMEOUT_MS, 10) || 15000
    };
};

const request = async ({ method, path, data, params }) => {
    const config = getClientConfig();
    try {
        const response = await axios({
            method,
            url: `${config.baseURL}${path}`,
            data,
            params,
            timeout: config.timeout,
            headers: {
                Authorization: `Bearer ${config.apiToken}`,
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            validateStatus: (status) => status >= 200 && status < 300
        });
        return response.data;
    } catch (error) {
        throw new PawaPayRequestError("La communication avec pawaPay a échoué.", {
            status: error.response?.status,
            responseData: error.response?.data,
            cause: error
        });
    }
};

const initiateDeposit = (payload) => request({
    method: "POST",
    path: "/v2/deposits",
    data: payload
});

const checkDeposit = (depositId) => request({
    method: "GET",
    path: `/v2/deposits/${encodeURIComponent(depositId)}`
});

const initiateRefund = ({ refundId, depositId, amount, currency }) => request({
    method: "POST",
    path: "/v2/refunds",
    data: amount && currency ? { refundId, depositId, amount, currency } : { refundId, depositId }
});

const checkRefund = (refundId) => request({
    method: "GET",
    path: `/v2/refunds/${encodeURIComponent(refundId)}`
});

const initiatePayout = (payload) => request({
    method: "POST",
    path: "/v2/payouts",
    data: payload
});

const checkPayout = (payoutId) => request({
    method: "GET",
    path: `/v2/payouts/${encodeURIComponent(payoutId)}`
});

// Opérateur et pays d'un numéro Mobile Money (numéro renvoyé normalisé au format international).
const predictProvider = (phoneNumber) => request({
    method: "POST",
    path: "/v2/predict-provider",
    data: { phoneNumber }
});

// Solde réel de chaque wallet du compte pawaPay (un wallet par pays et devise, parfois par opérateur).
const getWalletBalances = () => request({
    method: "GET",
    path: "/v2/wallet-balances"
});

const getActiveConfiguration = (operationType = "DEPOSIT") => {
    const { country } = getPaymentConfig();
    const params = { operationType };
    if (country) params.country = country;
    return request({
        method: "GET",
        path: "/v2/active-conf",
        params
    });
};

// operationType : "DEPOSIT" (encaissement) ou "PAYOUT" (reversement).
const extractProviders = (configuration, operationType = "DEPOSIT") => {
    const countries = Array.isArray(configuration?.countries)
        ? configuration.countries
        : Array.isArray(configuration?.data?.countries)
            ? configuration.data.countries
            : [];

    return countries.flatMap((country) => (
        Array.isArray(country.providers)
            ? country.providers.flatMap((provider) => {
                const currencyConfigs = Array.isArray(provider.currencies) && provider.currencies.length > 0
                    ? provider.currencies
                    : [null];
                return currencyConfigs.map((currencyConfig) => {
                    const operationTypes = currencyConfig?.operationTypes;
                    const depositConfig = Array.isArray(operationTypes)
                        ? operationTypes.find((operation) => (
                            operation.operationType === operationType || operation[operationType]
                        ))
                        : operationTypes?.[operationType];
                    const normalizedDepositConfig = depositConfig?.[operationType] || depositConfig;
                    return {
                        provider: provider.provider,
                        displayName: provider.displayName || provider.provider,
                        nameDisplayedToCustomer: provider.nameDisplayedToCustomer || null,
                        currency: currencyConfig?.currency || provider.currency || country.currency || null,
                        country: country.country || country.countryCode || null,
                        countryDisplayName: country.displayName || null,
                        prefix: country.prefix || null,
                        [operationType === "PAYOUT" ? "supportsPayout" : "supportsDeposit"]: !currencyConfig || Boolean(normalizedDepositConfig),
                        decimals: normalizedDepositConfig?.decimals
                            ?? normalizedDepositConfig?.decimalPlaces
                            ?? normalizedDepositConfig?.decimalsInAmount
                            ?? provider.decimals
                            ?? provider.decimalPlaces
                            ?? null,
                        authorizationType: normalizedDepositConfig?.authorizationType
                            || normalizedDepositConfig?.authType
                            || provider.authorizationType
                            || null
                    };
                });
            })
            : []
    )).filter((provider) => provider.provider);
};

module.exports = {
    PawaPayConfigurationError,
    PawaPayRequestError,
    getClientConfig,
    initiateDeposit,
    checkDeposit,
    initiateRefund,
    checkRefund,
    initiatePayout,
    checkPayout,
    predictProvider,
    getWalletBalances,
    getActiveConfiguration,
    extractProviders
};
