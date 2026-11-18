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
    assert.equal(PRO_FIXED_PRICES.USD, 85);
    assert.equal(getFixedPlanPrice("PRO", "USD"), 85);
    assert.equal(getFixedPlanPrice("PRO", "CDF"), 195500);
    assert.deepEqual(PRO_ANNUAL_FIXED_PRICES, {
        USD: 900,
        CDF: 2070000,
        XOF: 522000,
        XAF: 522000,
        RWF: 1323000,
        ZMW: 16650,
        KES: 117000,
        UGX: 3330000,
        TZS: 2367000,
        NGN: 1233000,
        GHS: 10530
    });
    assert.equal(getFixedPlanPrice("PRO", "USD", "ANNUAL"), 900);
    assert.equal(ESSENTIAL_ANNUAL_FIXED_PRICES.USD, 540);
    assert.equal(getFixedPlanPrice("ESSENTIAL", "USD", "ANNUAL"), 540);
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
