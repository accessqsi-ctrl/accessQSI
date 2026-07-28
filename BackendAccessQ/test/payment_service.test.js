const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { clearSrcModules, mockModule } = require("./helpers/http");

process.env.PRO_PAYMENTS_ENABLED = "true";

test("payment service normalizes national numbers with each country prefix", () => {
    clearSrcModules();
    mockModule("src/prisma/client.js", {});
    mockModule("src/services/pawapay.service.js", {});
    const { normalizePhoneNumber } = require("../src/services/payment.service");

    const congo = { country: "COD", prefix: "243" };
    assert.equal(normalizePhoneNumber("099 123 45 67", congo), "243991234567");
    assert.equal(normalizePhoneNumber("+243 991 234 567", congo), "243991234567");
    assert.equal(
        normalizePhoneNumber("024 123 4567", { country: "GHA", prefix: "233" }),
        "233241234567"
    );
    assert.throws(
        () => normalizePhoneNumber("1234"),
        (error) => error.code === "INVALID_PHONE_NUMBER"
    );
});

test("a Free organization can activate its Pro trial only once", async () => {
    clearSrcModules();
    const plans = new Map([
        ["FREE", { plan_id: 1, title: "FREE", cost: 0, currency: "USD", features: [] }],
        ["PRO", { plan_id: 2, title: "PRO", cost: 10, currency: "USD", features: [] }]
    ]);
    const organization = {
        org_id: 3,
        is_active: true,
        deleted_at: null,
        subscription_plan: 1,
        subscription_started_at: null,
        subscription_expires_at: null,
        trial_started_at: null,
        trial_expires_at: null
    };
    const withPlan = () => ({
        ...organization,
        plan: [...plans.values()].find((plan) => plan.plan_id === organization.subscription_plan)
    });
    const prisma = {
        plan: {
            upsert: async ({ create, update }) => {
                const current = plans.get(create.title);
                const saved = current ? { ...current, ...update } : create;
                plans.set(create.title, saved);
                return saved;
            },
            findMany: async () => [...plans.values()],
            findUnique: async ({ where }) => plans.get(where.title) || null
        },
        organization: {
            findUnique: async () => withPlan(),
            updateMany: async ({ data }) => {
                if (organization.trial_started_at) return { count: 0 };
                Object.assign(organization, data);
                return { count: 1 };
            }
        }
    };

    mockModule("src/prisma/client.js", prisma);
    mockModule("src/services/pawapay.service.js", {});
    const paymentService = require("../src/services/payment.service");
    const subscription = await paymentService.startProTrial(organization.org_id);

    assert.equal(subscription.plan, "PRO");
    assert.equal(subscription.isTrial, true);
    assert.equal(subscription.trialAvailable, false);
    assert.ok(organization.trial_started_at instanceof Date);
    assert.equal(
        Math.round(
            (organization.trial_expires_at - organization.trial_started_at)
            / (24 * 60 * 60 * 1000)
        ),
        30
    );
    await assert.rejects(
        paymentService.startProTrial(organization.org_id),
        (error) => error.code === "TRIAL_ALREADY_USED"
    );
});

test("completed pawaPay deposit activates Pro and records the access period atomically", async () => {
    clearSrcModules();
    const existingPayment = {
        payment_id: 7,
        deposit_id: "2f3770c5-dcb4-4f29-b2ae-9a91ad91369e",
        org_id: 3,
        plan_id: 2,
        initiated_by_id: 5,
        amount: new Prisma.Decimal("5"),
        currency: "USD",
        country: "COD",
        provider: "AIRTEL_COD",
        phone_number: "243991234567",
        status: "PENDING",
        provider_transaction_id: null,
        failure_code: null,
        failure_message: null,
        access_starts_at: null,
        access_expires_at: null,
        created_at: new Date("2026-07-27T10:00:00Z"),
        completed_at: null,
        plan: { plan_id: 2, title: "PRO", cost: 5, currency: "USD", features: [] }
    };

    let organizationUpdate = null;
    let paymentUpdate = null;
    const completedPayment = {
        ...existingPayment,
        status: "COMPLETED",
        provider_transaction_id: "MNO-123",
        completed_at: new Date()
    };
    const tx = {
        $queryRaw: async () => [{ org_id: 3 }],
        payment: {
            findUnique: async () => existingPayment,
            update: async ({ data }) => {
                paymentUpdate = data;
                return {
                    ...completedPayment,
                    access_starts_at: data.access_starts_at,
                    access_expires_at: data.access_expires_at
                };
            }
        },
        organization: {
            findUnique: async () => ({
                org_id: 3,
                subscription_started_at: null,
                subscription_expires_at: null
            }),
            update: async ({ data }) => {
                organizationUpdate = data;
                return data;
            }
        }
    };
    const prisma = {
        payment: { findUnique: async () => existingPayment },
        $transaction: async (callback) => callback(tx)
    };
    const pawaPay = {
        checkDeposit: async () => ({
            status: "FOUND",
            data: {
                depositId: existingPayment.deposit_id,
                status: "COMPLETED",
                amount: "5.00",
                currency: "USD",
                providerTransactionId: "MNO-123"
            }
        })
    };

    mockModule("src/prisma/client.js", prisma);
    mockModule("src/services/pawapay.service.js", pawaPay);
    const paymentService = require("../src/services/payment.service");
    const result = await paymentService.reconcilePayment(existingPayment.deposit_id);

    assert.equal(result.status, "COMPLETED");
    assert.equal(organizationUpdate.subscription_plan, 2);
    assert.ok(organizationUpdate.subscription_started_at instanceof Date);
    assert.ok(organizationUpdate.subscription_expires_at instanceof Date);
    assert.equal(
        Math.round(
            (organizationUpdate.subscription_expires_at - organizationUpdate.subscription_started_at)
            / (24 * 60 * 60 * 1000)
        ),
        30
    );
    assert.equal(paymentUpdate.provider_transaction_id, "MNO-123");
    assert.equal(paymentUpdate.status, "COMPLETED");
});

test("reconciliation rejects a completed deposit whose amount differs", async () => {
    clearSrcModules();
    const payment = {
        payment_id: 8,
        deposit_id: "6c36af82-a75a-432d-a8ce-33f71b8f56f1",
        org_id: 3,
        plan_id: 2,
        amount: new Prisma.Decimal("5"),
        currency: "USD",
        country: "COD",
        provider: "AIRTEL_COD",
        phone_number: "243991234567",
        status: "PENDING",
        created_at: new Date(),
        plan: { title: "PRO" }
    };
    mockModule("src/prisma/client.js", {
        payment: { findUnique: async () => payment }
    });
    mockModule("src/services/pawapay.service.js", {
        checkDeposit: async () => ({
            status: "FOUND",
            data: {
                depositId: payment.deposit_id,
                status: "COMPLETED",
                amount: "1",
                currency: "USD"
            }
        })
    });
    const paymentService = require("../src/services/payment.service");

    await assert.rejects(
        paymentService.reconcilePayment(payment.deposit_id),
        (error) => error.code === "PAYMENT_RECONCILIATION_MISMATCH"
    );
});
