const test = require("node:test");
const assert = require("node:assert/strict");

const { getPaymentConfig } = require("../src/config/payment");
const { extractProviders } = require("../src/services/pawapay.service");
const {
    ESSENTIAL_ANNUAL_FIXED_PRICES,
    PRO_ANNUAL_FIXED_PRICES,
    PRO_FIXED_PRICES,
    getFixedPlanPrice,
    getPlanSummary
} = require("../src/config/subscription");

test("payment config defaults to USD without restricting the country", () => {
    const config = getPaymentConfig({});
    assert.equal(config.country, null);
    assert.equal(config.currency, "USD");
    assert.equal(config.subscriptionDays, 30);
    assert.equal(config.enabled, false);
});

test("active pawaPay configuration is reduced to public provider fields", () => {
    const providers = extractProviders({
        countries: [{
            country: "COD",
            displayName: { fr: "RDC", en: "DRC" },
            prefix: "243",
            providers: [{
                provider: "AIRTEL_COD",
                displayName: "Airtel Money",
                currencies: [{
                    currency: "CDF",
                    operationTypes: [{
                        operationType: "DEPOSIT",
                        authType: "PROVIDER_AUTH",
                        decimals: 0
                    }]
                }]
            }]
        }]
    });

    assert.deepEqual(providers, [{
        provider: "AIRTEL_COD",
        displayName: "Airtel Money",
        nameDisplayedToCustomer: null,
        currency: "CDF",
        country: "COD",
        countryDisplayName: { fr: "RDC", en: "DRC" },
        prefix: "243",
        supportsDeposit: true,
        decimals: 0,
        authorizationType: "PROVIDER_AUTH"
    }]);
});

test("the approved Pro and Essential annual prices are exposed", () => {
    assert.deepEqual(PRO_FIXED_PRICES, {
        USD: 25,
        CDF: 57500,
        XOF: 14500,
        XAF: 14500,
        RWF: 36750,
        ZMW: 463,
        KES: 3250,
        UGX: 92500,
        TZS: 65750,
        NGN: 34250,
        GHS: 293
    });
    assert.equal(getFixedPlanPrice("PRO", "USD"), 25);
    assert.equal(getFixedPlanPrice("PRO", "CDF"), 57500);
    assert.deepEqual(PRO_ANNUAL_FIXED_PRICES, {
        USD: 240,
        CDF: 552000,
        XOF: 139200,
        XAF: 139200,
        RWF: 352800,
        ZMW: 4440,
        KES: 31200,
        UGX: 888000,
        TZS: 631200,
        NGN: 328800,
        GHS: 2808
    });
    assert.equal(getFixedPlanPrice("PRO", "USD", "ANNUAL"), 240);
    assert.equal(ESSENTIAL_ANNUAL_FIXED_PRICES.USD, 144);
    assert.equal(getFixedPlanPrice("ESSENTIAL", "USD", "ANNUAL"), 144);
    assert.equal(getFixedPlanPrice("PRO", "EUR"), null);
});

test("an expired Pro subscription is exposed as Discovery", () => {
    const summary = getPlanSummary({
        plan: { title: "PRO" },
        subscription_expires_at: new Date(Date.now() - 1000)
    });

    assert.equal(summary.plan, "DISCOVERY");
    assert.equal(summary.isPro, false);
});
