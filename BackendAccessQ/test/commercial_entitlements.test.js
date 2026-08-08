const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");

const loadQuotaService = (tx) => {
    clearSrcModules();
    mockModule("src/prisma/client", {
        $transaction: async (callback) => callback(tx)
    });
    return require("../src/services/organization_quota.service");
};

test("le quota mensuel compte aussi les événements supprimés du cycle", async () => {
    let eventWhere = null;
    let created = false;
    const tx = {
        $queryRaw: async () => [],
        organization: {
            findUnique: async () => ({
                created_at: new Date("2026-08-01T00:00:00Z"),
                plan: { title: "ESSENTIAL" }
            })
        },
        event: {
            count: async ({ where }) => {
                eventWhere = where;
                return 5;
            }
        }
    };
    const { withEventCreationQuota } = loadQuotaService(tx);
    await assert.rejects(
        withEventCreationQuota({
            organizationId: 42,
            create: async () => { created = true; }
        }),
        (error) => error.code === "PLAN_QUOTA_EXCEEDED" && error.limit === 5
    );
    assert.equal(created, false);
    assert.equal(Object.hasOwn(eventWhere, "deleted_at"), false);
    assert.ok(eventWhere.created_at.gte instanceof Date);
    assert.ok(eventWhere.created_at.lt instanceof Date);
});

test("un Pass disponible est attribué explicitement et démarre ses 30 jours", async () => {
    let passUpdate = null;
    let entitlement = null;
    const tx = {
        $queryRaw: async () => [],
        organization: { findUnique: async () => ({ plan: { title: "DISCOVERY" } }) },
        eventPass: {
            findFirst: async () => ({ event_pass_id: 9, status: "AVAILABLE" }),
            update: async (args) => { passUpdate = args; return args.data; }
        }
    };
    const { withEventCreationQuota } = loadQuotaService(tx);
    const event = await withEventCreationQuota({
        organizationId: 42,
        eventPassId: 9,
        create: async (client, received) => {
            assert.equal(client, tx);
            entitlement = received;
            return { event_id: 77 };
        }
    });
    assert.equal(event.event_id, 77);
    assert.equal(entitlement.entitlementType, "EVENT_PASS");
    assert.equal(entitlement.qrLimit, 200);
    assert.equal(passUpdate.data.event_id, 77);
    assert.equal(passUpdate.data.status, "ASSIGNED");
    assert.equal(
        Math.round((passUpdate.data.expires_at - passUpdate.data.activated_at) / 86_400_000),
        30
    );
});

test("le quota QR est propre à l'événement et une suppression ne le restitue pas", async () => {
    let qrWhere = null;
    const tx = {
        $queryRaw: async () => [],
        organization: { findUnique: async () => ({ plan: { title: "ESSENTIAL" } }) },
        event: {
            findFirst: async () => ({
                event_id: 7,
                org_id: 42,
                entitlement_type: "SUBSCRIPTION",
                qr_limit: 200,
                deleted_at: null
            })
        },
        qrCode: {
            count: async ({ where }) => {
                qrWhere = where;
                return 200;
            }
        }
    };
    const { withEventQrQuota } = loadQuotaService(tx);
    await assert.rejects(
        withEventQrQuota({ organizationId: 42, eventId: 7, create: async () => ({}) }),
        (error) => error.code === "PLAN_QUOTA_EXCEEDED" && error.limit === 200
    );
    assert.deepEqual(qrWhere, { event_id: 7 });
});

test("un Pass expiré conserve les données mais bloque les nouveaux QR", async () => {
    const tx = {
        $queryRaw: async () => [],
        organization: { findUnique: async () => ({ plan: { title: "PRO" } }) },
        event: {
            findFirst: async () => ({
                event_id: 7,
                org_id: 42,
                entitlement_type: "EVENT_PASS",
                entitlement_expires_at: new Date(Date.now() - 1000),
                qr_limit: 200,
                deleted_at: null
            })
        }
    };
    const { withEventQrQuota } = loadQuotaService(tx);
    await assert.rejects(
        withEventQrQuota({ organizationId: 42, eventId: 7, create: async () => ({}) }),
        (error) => error.code === "EVENT_PASS_EXPIRED"
    );
});
