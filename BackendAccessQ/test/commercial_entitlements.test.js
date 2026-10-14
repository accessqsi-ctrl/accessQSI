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

test("une reprise idempotente retrouve le QR avant de réévaluer un quota désormais plein", async () => {
    let counted = false;
    let created = false;
    const existingQr = { qr_id: 91, event_id: 7 };
    const tx = {
        $queryRaw: async () => [],
        organization: { findUnique: async () => ({ plan: { title: "DISCOVERY" } }) },
        event: {
            findFirst: async () => ({
                event_id: 7,
                org_id: 42,
                entitlement_type: "SUBSCRIPTION",
                qr_limit: 50,
                deleted_at: null
            })
        },
        qrCode: {
            count: async () => { counted = true; return 50; }
        }
    };
    const { withEventQrQuota } = loadQuotaService(tx);
    const result = await withEventQrQuota({
        organizationId: 42,
        eventId: 7,
        resolveExisting: async client => {
            assert.equal(client, tx);
            return existingQr;
        },
        create: async () => { created = true; }
    });

    assert.equal(result, existingQr);
    assert.equal(counted, false);
    assert.equal(created, false);
});

test("deux émissions concurrentes ne consomment pas la même dernière place du quota QR", async () => {
    clearSrcModules();
    let activeQrs = 49;
    let nextQrId = 1;
    let transactionQueue = Promise.resolve();
    mockModule("src/prisma/client", {
        $transaction: async callback => {
            const previous = transactionQueue;
            let release;
            transactionQueue = new Promise(resolve => { release = resolve; });
            await previous;
            const tx = {
                $queryRaw: async () => [],
                organization: { findUnique: async () => ({ plan: { title: "DISCOVERY" } }) },
                event: {
                    findFirst: async () => ({
                        event_id: 7,
                        org_id: 42,
                        entitlement_type: "SUBSCRIPTION",
                        qr_limit: 50,
                        deleted_at: null
                    })
                },
                qrCode: { count: async () => activeQrs }
            };
            try {
                return await callback(tx);
            } finally {
                release();
            }
        }
    });
    const { withEventQrQuota } = require("../src/services/organization_quota.service");
    const issue = () => withEventQrQuota({
        organizationId: 42,
        eventId: 7,
        create: async () => {
            activeQrs += 1;
            return { qr_id: nextQrId++ };
        }
    });

    const results = await Promise.allSettled([issue(), issue()]);

    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    assert.equal(results.find(result => result.status === "rejected").reason.code, "PLAN_QUOTA_EXCEEDED");
    assert.equal(activeQrs, 50);
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
