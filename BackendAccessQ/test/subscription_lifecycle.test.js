const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { clearSrcModules, mockModule } = require("./helpers/http");

process.env.PRO_PAYMENTS_ENABLED = "true";

const loadPolicy = () => {
    clearSrcModules();
    mockModule("src/prisma/client.js", {});
    mockModule("src/services/pawapay.service.js", {});
    return require("../src/services/payment.service").subscriptionPolicy;
};

const organization = ({ plan, interval = "MONTHLY", start, end, trialEnd = null }) => ({
    org_id: 3,
    created_at: start,
    subscription_plan: plan === "ESSENTIAL" ? 2 : plan === "PRO" ? 3 : 1,
    subscription_started_at: start,
    subscription_expires_at: end,
    subscription_interval: interval,
    trial_started_at: trialEnd ? start : null,
    trial_expires_at: trialEnd,
    plan: { title: plan }
});

test("la politique couvre achat, renouvellement, upgrade, downgrade et changement de périodicité", () => {
    const { classifyChange } = loadPolicy();
    const now = new Date("2026-08-15T00:00:00Z");
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-09-01T00:00:00Z");

    assert.equal(classifyChange({
        organization: organization({ plan: "DISCOVERY", start, end: null }),
        targetPlan: "ESSENTIAL",
        targetInterval: "MONTHLY",
        now
    }).type, "PURCHASE");
    assert.equal(classifyChange({
        organization: organization({ plan: "ESSENTIAL", start, end }),
        targetPlan: "ESSENTIAL",
        targetInterval: "MONTHLY",
        now
    }).type, "RENEWAL");
    assert.deepEqual(classifyChange({
        organization: organization({ plan: "ESSENTIAL", start, end }),
        targetPlan: "PRO",
        targetInterval: "MONTHLY",
        now
    }), { type: "UPGRADE", effectiveAt: now, prorated: true });
    assert.deepEqual(classifyChange({
        organization: organization({ plan: "PRO", start, end }),
        targetPlan: "ESSENTIAL",
        targetInterval: "MONTHLY",
        now
    }), { type: "DOWNGRADE", effectiveAt: end, prorated: false });
    assert.deepEqual(classifyChange({
        organization: organization({ plan: "ESSENTIAL", start, end }),
        targetPlan: "ESSENTIAL",
        targetInterval: "ANNUAL",
        now
    }), { type: "INTERVAL_CHANGE", effectiveAt: end, prorated: false });
});

test("un achat pendant un essai est programmé à la fin de l’essai", () => {
    const { classifyChange } = loadPolicy();
    const now = new Date("2026-08-15T00:00:00Z");
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-09-01T00:00:00Z");
    const result = classifyChange({
        organization: organization({ plan: "PRO", start, end, trialEnd: end }),
        targetPlan: "ESSENTIAL",
        targetInterval: "MONTHLY",
        now
    });
    assert.deepEqual(result, { type: "DOWNGRADE", effectiveAt: end, prorated: false });
});

test("le prorata couvre aussi les mois déjà prépayés et respecte les décimales opérateur", () => {
    const { getRemainingMonthlyUnits, roundForProvider } = loadPolicy();
    const units = getRemainingMonthlyUnits(
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-10-01T00:00:00Z"),
        new Date("2026-08-16T12:00:00Z")
    );
    assert.ok(units > 1.49 && units < 1.51);
    assert.equal(roundForProvider(184.6, 0), 185);
    assert.equal(roundForProvider(5.555, 2), 5.56);
});

test("le devis d’upgrade facture uniquement la différence proratisée", () => {
    const { calculatePaymentQuote } = loadPolicy();
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-09-01T00:00:00Z");
    const quote = calculatePaymentQuote({
        organization: organization({ plan: "ESSENTIAL", start, end }),
        plan: { title: "PRO", cost: 25, currency: "USD" },
        provider: { currency: "USD", decimals: 2 },
        billingInterval: "MONTHLY",
        now: new Date("2026-08-16T12:00:00Z")
    });
    assert.equal(quote.transition.type, "UPGRADE");
    assert.equal(quote.localPrice, 5);
    assert.equal(quote.creditAmount, 7.5);
    assert.equal(quote.referencePrice, 5);
});

test("un downgrade payé est programmé sans remplacer immédiatement le plan actif", async () => {
    clearSrcModules();
    const end = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const change = {
        subscription_change_id: 44,
        subscription_id: 8,
        source_version: 3,
        type: "DOWNGRADE",
        status: "AWAITING_PAYMENT",
        effective_at: end,
        to_interval: "MONTHLY",
        from_plan: { title: "PRO" },
        to_plan: { title: "ESSENTIAL" }
    };
    const payment = {
        payment_id: 12,
        deposit_id: "b03cd8bb-55dd-4f4b-90b3-d2c23d88a8ba",
        org_id: 3,
        plan_id: 2,
        subscription_change_id: 44,
        amount: new Prisma.Decimal("15"),
        reference_amount: new Prisma.Decimal("15"),
        reference_currency: "USD",
        currency: "USD",
        country: "COD",
        provider: "AIRTEL_COD",
        phone_number: "243991234567",
        status: "PENDING",
        billing_interval: "MONTHLY",
        plan: { plan_id: 2, title: "ESSENTIAL", cost: 15, currency: "USD" },
        subscription_change: change
    };
    let organizationUpdated = false;
    let changeStatus = null;
    const tx = {
        $queryRaw: async () => [],
        payment: {
            findUnique: async () => payment,
            update: async ({ data }) => ({ ...payment, ...data, subscription_change: { ...change, status: changeStatus || change.status } })
        },
        organization: {
            findUnique: async () => ({
                org_id: 3,
                subscription_plan: 3,
                subscription_started_at: new Date("2026-08-01T00:00:00Z"),
                subscription_expires_at: end,
                subscription_interval: "MONTHLY",
                plan: { plan_id: 3, title: "PRO" }
            }),
            update: async () => { organizationUpdated = true; }
        },
        subscription: { upsert: async () => ({ subscription_id: 8, version: 3 }) },
        subscriptionChange: {
            update: async ({ data }) => { changeStatus = data.status; return { ...change, ...data }; }
        }
    };
    mockModule("src/prisma/client.js", {
        payment: { findUnique: async () => payment },
        $transaction: async (callback) => callback(tx)
    });
    mockModule("src/services/pawapay.service.js", {
        checkDeposit: async () => ({
            status: "FOUND",
            data: { depositId: payment.deposit_id, status: "COMPLETED", amount: "15", currency: "USD" }
        })
    });
    const service = require("../src/services/payment.service");
    const result = await service.reconcilePayment(payment.deposit_id);
    assert.equal(result.status, "COMPLETED");
    assert.equal(changeStatus, "SCHEDULED");
    assert.equal(organizationUpdated, false);
    assert.equal(new Date(result.accessStartsAt).toISOString(), end.toISOString());
});

test("un upgrade payé conserve l’ancrage et la date de fin du cycle", async () => {
    clearSrcModules();
    const started = new Date("2026-08-01T00:00:00Z");
    const end = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const change = {
        subscription_change_id: 45,
        subscription_id: 8,
        source_version: 4,
        type: "UPGRADE",
        status: "AWAITING_PAYMENT",
        effective_at: new Date(),
        to_interval: "MONTHLY",
        from_plan: { title: "ESSENTIAL" },
        to_plan: { title: "PRO" }
    };
    const payment = {
        payment_id: 13,
        deposit_id: "a0372ef0-2264-44ae-a5ee-986b955f25c2",
        org_id: 3,
        plan_id: 3,
        subscription_change_id: 45,
        amount: new Prisma.Decimal("5"),
        reference_amount: new Prisma.Decimal("5"),
        reference_currency: "USD",
        currency: "USD",
        country: "COD",
        provider: "AIRTEL_COD",
        phone_number: "243991234567",
        status: "PENDING",
        billing_interval: "MONTHLY",
        plan: { plan_id: 3, title: "PRO", cost: 25, currency: "USD" },
        subscription_change: change
    };
    let orgUpdate;
    let period;
    const tx = {
        $queryRaw: async () => [],
        payment: {
            findUnique: async () => payment,
            update: async ({ data }) => ({ ...payment, ...data, subscription_change: change })
        },
        organization: {
            findUnique: async () => ({
                org_id: 3,
                subscription_plan: 2,
                subscription_started_at: started,
                subscription_expires_at: end,
                subscription_interval: "MONTHLY",
                trial_expires_at: null,
                plan: { plan_id: 2, title: "ESSENTIAL" }
            }),
            update: async ({ data }) => { orgUpdate = data; return data; }
        },
        subscription: {
            upsert: async () => ({ subscription_id: 8, version: 4 }),
            update: async ({ data }) => data
        },
        subscriptionChange: { update: async ({ data }) => ({ ...change, ...data }) },
        subscriptionPeriod: { create: async ({ data }) => { period = data; return data; } }
    };
    mockModule("src/prisma/client.js", {
        payment: { findUnique: async () => payment },
        $transaction: async (callback) => callback(tx)
    });
    mockModule("src/services/pawapay.service.js", {
        checkDeposit: async () => ({
            status: "FOUND",
            data: { depositId: payment.deposit_id, status: "COMPLETED", amount: "5", currency: "USD" }
        })
    });
    const service = require("../src/services/payment.service");
    await service.reconcilePayment(payment.deposit_id);
    assert.equal(orgUpdate.subscription_plan, 3);
    assert.equal(orgUpdate.subscription_started_at.toISOString(), started.toISOString());
    assert.equal(orgUpdate.subscription_expires_at.toISOString(), end.toISOString());
    assert.equal(period.source, "UPGRADE");
    assert.equal(period.ends_at.toISOString(), end.toISOString());
});

test("un remboursement confirmé annule le changement futur sans toucher au plan courant", async () => {
    clearSrcModules();
    const change = { subscription_change_id: 50, subscription_id: 8, status: "REFUND_PENDING" };
    const existing = {
        refund_id: 4,
        provider_refund_id: "913565bd-9931-44dc-919c-bf960188282c",
        payment_id: 15,
        org_id: 3,
        status: "PENDING",
        payment: { payment_id: 15, subscription_change: change }
    };
    let paymentStatus;
    let changeStatus;
    const tx = {
        $queryRaw: async () => [],
        refund: { update: async ({ data }) => ({ ...existing, ...data }) },
        payment: { update: async ({ data }) => { paymentStatus = data.status; return data; } },
        subscriptionChange: { update: async ({ data }) => { changeStatus = data.status; return data; } },
        subscription: { update: async ({ data }) => data }
    };
    mockModule("src/prisma/client.js", {
        refund: { findUnique: async () => existing },
        $transaction: async (callback) => callback(tx)
    });
    mockModule("src/services/pawapay.service.js", {
        checkRefund: async () => ({
            status: "FOUND",
            data: { refundId: existing.provider_refund_id, status: "COMPLETED", providerTransactionId: "REF-1" }
        })
    });
    const service = require("../src/services/payment.service");
    const result = await service.reconcileRefund(existing.provider_refund_id);
    assert.equal(result.status, "COMPLETED");
    assert.equal(paymentStatus, "REFUNDED");
    assert.equal(changeStatus, "CANCELED");
});
