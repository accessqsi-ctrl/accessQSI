const test = require("node:test");
const assert = require("node:assert/strict");

const { getPaymentConfig } = require("../src/config/payment");
const { extractProviders } = require("../src/services/pawapay.service");
const {
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

test("Pro exposes the approved fixed local price catalogue", () => {
    assert.deepEqual(PRO_FIXED_PRICES, {
        USD: 10,
        CDF: 23000,
        XOF: 5800,
        XAF: 5800,
        RWF: 14700,
        ZMW: 185,
        KES: 1300,
        UGX: 37000,
        TZS: 26300,
        NGN: 13700,
        GHS: 117
    });
    assert.equal(getFixedPlanPrice("PRO", "USD"), 10);
    assert.equal(getFixedPlanPrice("PRO", "CDF"), 23000);
    assert.equal(getFixedPlanPrice("PRO", "XOF"), 5800);
    assert.equal(getFixedPlanPrice("PRO", "RWF"), 14700);
    assert.equal(getFixedPlanPrice("PRO", "NGN"), 13700);
    assert.equal(getFixedPlanPrice("PRO", "EUR"), null);
});

test("an expired Pro subscription is exposed as Free", () => {
    const summary = getPlanSummary({
        plan: { title: "PRO" },
        subscription_expires_at: new Date(Date.now() - 1000)
    });

    assert.equal(summary.plan, "FREE");
    assert.equal(summary.isPro, false);
});
