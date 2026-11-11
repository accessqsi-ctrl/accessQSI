const test = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/prisma/client");
const pawaPay = require("../src/services/pawapay.service");
const payouts = require("../src/services/organizer_payout.service");
const { roundForProvider } = require("../src/services/payment/policy");

const configuration = {
    countries: [{
        country: "CIV",
        prefix: "225",
        providers: [
            { provider: "ORANGE_CIV", currencies: [{ currency: "XOF", operationTypes: { DEPOSIT: { authType: "PROVIDER_AUTH", decimalsInAmount: "NONE" } } }] },
            { provider: "WAVE_CIV", currencies: [{ currency: "XOF", operationTypes: { DEPOSIT: { authType: "REDIRECT_AUTH", decimalsInAmount: "NONE" } } }] }
        ]
    }, {
        country: "BFA",
        prefix: "226",
        providers: [{ provider: "ORANGE_BFA", currencies: [{ currency: "XOF", operationTypes: [{ operationType: "DEPOSIT", authType: "PREAUTH", decimalsInAmount: "NONE" }] }] }]
    }, {
        country: "COD",
        prefix: "243",
        providers: [{ provider: "AIRTEL_COD", currencies: [{ currency: "USD", operationTypes: { DEPOSIT: { authType: "PROVIDER_AUTH", decimalsInAmount: "TWO_PLACES" } } }] }]
    }]
};

test("pawaPay v2 decimals are read as numbers so amounts are rounded for the provider", () => {
    assert.equal(pawaPay.normalizeDecimals("NONE"), 0);
    assert.equal(pawaPay.normalizeDecimals("TWO_PLACES"), 2);
    assert.equal(pawaPay.normalizeDecimals(0), 0);
    assert.equal(pawaPay.normalizeDecimals(2), 2);
    assert.equal(pawaPay.normalizeDecimals(undefined), null);
    assert.equal(pawaPay.normalizeDecimals("ODD"), null);

    const providers = pawaPay.extractProviders(configuration);
    const orange = providers.find(item => item.provider === "ORANGE_CIV");
    assert.equal(orange.decimals, 0);
    assert.equal(providers.find(item => item.provider === "AIRTEL_COD").decimals, 2);
    assert.equal(roundForProvider("1500.50", orange.decimals), 1501);
    assert.notEqual(roundForProvider("1500.50", orange.decimals), 1500.5);
});

test("only PIN-prompt providers are offered for deposits", () => {
    const offered = pawaPay.extractProviders(configuration).filter(pawaPay.isSupportedDepositProvider).map(item => item.provider);
    assert.deepEqual(offered, ["ORANGE_CIV", "AIRTEL_COD"]);
    // Sans type d'autorisation connu (ancienne configuration), l'opérateur reste proposé.
    assert.equal(pawaPay.isSupportedDepositProvider({ provider: "X", authorizationType: null }), true);
    assert.equal(pawaPay.isSupportedDepositProvider({ provider: "X", supportsDeposit: false }), false);
});

test("a definitive pawaPay rejection is told apart from an uncertain outcome", () => {
    const rejected = (status, failureCode) => new pawaPay.PawaPayRequestError("x", { status, responseData: { status: "REJECTED", failureReason: { failureCode } } });
    assert.equal(pawaPay.isDefinitiveRejection(rejected(400, "INVALID_PARAMETER")), true);
    assert.equal(pawaPay.isDefinitiveRejection(rejected(403, "PAYOUTS_NOT_ALLOWED")), true);
    assert.equal(pawaPay.isDefinitiveRejection(rejected(403, "REFUNDS_NOT_ALLOWED")), true);
    // Jeton ou signature : problème de configuration, on réessaie après correction.
    assert.equal(pawaPay.isDefinitiveRejection(rejected(403, "AUTHENTICATION_ERROR")), false);
    assert.equal(pawaPay.isDefinitiveRejection(rejected(403, "HTTP_SIGNATURE_ERROR")), false);
    assert.equal(pawaPay.isDefinitiveRejection(rejected(401, "NO_AUTHENTICATION")), false);
    assert.equal(pawaPay.isDefinitiveRejection(new pawaPay.PawaPayRequestError("x", { status: 500, responseData: { failureReason: { failureCode: "UNKNOWN_ERROR" } } })), false);
    assert.equal(pawaPay.isDefinitiveRejection(new pawaPay.PawaPayRequestError("timeout")), false);
    assert.equal(pawaPay.isDefinitiveRejection(new Error("x")), false);
});

test("a payout rejected with HTTP 400 fails and returns to the balance instead of being resent forever", async t => {
    const saved = {
        env: process.env.TICKET_PAYMENTS_ENABLED,
        initiate: pawaPay.initiatePayout,
        payout: prisma.organizerPayout,
        refund: prisma.ticketRefund,
        ledger: prisma.organizerLedgerEntry,
        transaction: prisma.$transaction
    };
    t.after(() => {
        process.env.TICKET_PAYMENTS_ENABLED = saved.env;
        Object.assign(pawaPay, { initiatePayout: saved.initiate });
        Object.assign(prisma, { organizerPayout: saved.payout, ticketRefund: saved.refund, organizerLedgerEntry: saved.ledger, $transaction: saved.transaction });
        if (saved.env === undefined) delete process.env.TICKET_PAYMENTS_ENABLED;
    });
    process.env.TICKET_PAYMENTS_ENABLED = "true";

    const payout = { payout_id: "11111111-1111-4111-8111-111111111111", provider_payout_id: "22222222-2222-4222-8222-222222222222", org_id: 3, amount: "20", currency: "USD", country: "COD", provider: "AIRTEL_COD", phone_number: "243997654321", manual_recipient: false, status: "APPROVED" };
    const statuses = [];
    const reversals = [];
    let calls = 0;
    prisma.organizerPayout = {
        findMany: async ({ where }) => (where.status === "APPROVED" && payout.status === "APPROVED" ? [{ ...payout }] : []),
        updateMany: async ({ where, data }) => {
            const from = where.status?.in || [where.status];
            if (!from.includes(payout.status)) return { count: 0 };
            payout.status = data.status;
            statuses.push(data.status);
            return { count: 1 };
        },
        update: async ({ data }) => { payout.status = data.status; statuses.push(data.status); }
    };
    prisma.ticketRefund = { findMany: async () => [] };
    prisma.organizerLedgerEntry = { upsert: async ({ create }) => { reversals.push(create); } };
    prisma.$transaction = async work => work(prisma);
    pawaPay.initiatePayout = async () => {
        calls += 1;
        throw new pawaPay.PawaPayRequestError("rejected", { status: 400, responseData: { status: "REJECTED", failureReason: { failureCode: "INVALID_PARAMETER", failureMessage: "Value for parameter 'provider' is invalid." } } });
    };

    await payouts.processPending();
    await payouts.processPending();
    assert.equal(calls, 1);
    assert.deepEqual(statuses, ["SUBMITTING", "FAILED"]);
    assert.equal(reversals.length, 1);
    assert.equal(reversals[0].type, "PAYOUT_REVERSAL");

    // Une issue incertaine (timeout) laisse au contraire le reversement « validé » pour le prochain passage.
    Object.assign(payout, { status: "APPROVED" });
    statuses.length = 0;
    pawaPay.initiatePayout = async () => { throw new pawaPay.PawaPayRequestError("timeout"); };
    await payouts.processPending();
    assert.deepEqual(statuses, ["SUBMITTING", "APPROVED"]);
});

test("an unavailable payout operator gets a reason the super-admin can act on", async t => {
    const saved = { conf: pawaPay.getActiveConfiguration, env: { ...process.env }, payout: prisma.organizerPayout, ledger: prisma.organizerLedgerEntry, transaction: prisma.$transaction };
    t.after(() => {
        pawaPay.getActiveConfiguration = saved.conf;
        for (const key of ["PAWAPAY_PROVIDERS", "PAWAPAY_COUNTRY", "TICKET_PAYMENTS_ENABLED"]) {
            if (saved.env[key] === undefined) delete process.env[key]; else process.env[key] = saved.env[key];
        }
        Object.assign(prisma, { organizerPayout: saved.payout, organizerLedgerEntry: saved.ledger, $transaction: saved.transaction });
        payouts.resetProviderCache();
    });
    process.env.TICKET_PAYMENTS_ENABLED = "true";
    const operation = (decimals, extra = {}) => ({ currency: "USD", operationTypes: { PAYOUT: { decimalsInAmount: decimals, ...extra } } });
    pawaPay.getActiveConfiguration = async () => ({ countries: [{ country: "COD", prefix: "243", providers: [
        { provider: "VODACOM_MPESA_COD", currencies: [operation("TWO_PLACES")] },
        { provider: "ORANGE_COD", currencies: [{ currency: "CDF", operationTypes: { PAYOUT: { decimalsInAmount: "TWO_PLACES" } } }] },
        { provider: "AIRTEL_COD", currencies: [operation("TWO_PLACES")] }
    ] }] });

    let failure = null;
    const payout = { payout_id: "33333333-3333-4333-8333-333333333333", provider_payout_id: "44444444-4444-4444-8444-444444444444", org_id: null, amount: "5", currency: "USD", country: "COD", phone_number: "243997654321", manual_recipient: true };
    prisma.organizerPayout = {
        findMany: async ({ where }) => (where.status === "APPROVED" ? [{ ...payout, status: "APPROVED" }] : []),
        updateMany: async ({ data }) => { if (data.status === "FAILED") failure = data; return { count: 1 }; }
    };
    prisma.ticketRefund = { findMany: async () => [] };
    prisma.organizerLedgerEntry = { upsert: async () => {} };
    prisma.$transaction = async work => work(prisma);
    const reasonFor = async provider => {
        failure = null;
        payouts.resetProviderCache();
        payout.provider = provider;
        await payouts.processPending();
        return failure;
    };

    process.env.PAWAPAY_PROVIDERS = "VODACOM_MPESA_COD";
    let result = await reasonFor("AIRTEL_COD");
    assert.equal(result.failure_code, "PROVIDER_NOT_AVAILABLE");
    assert.match(result.failure_message, /exclu par PAWAPAY_PROVIDERS/);
    delete process.env.PAWAPAY_PROVIDERS;

    assert.match((await reasonFor("ORANGE_COD")).failure_message, /ne verse pas en USD \(devises : CDF\)/);
    assert.match((await reasonFor("MTN_MOMO_COD")).failure_message, /non activé en reversement sur le compte pawaPay/);
    process.env.PAWAPAY_COUNTRY = "COD";
    payout.country = "CMR";
    assert.match((await reasonFor("MTN_MOMO_CMR")).failure_message, /PAWAPAY_COUNTRY=COD/);
});
