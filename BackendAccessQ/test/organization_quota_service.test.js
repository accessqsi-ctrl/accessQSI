const test = require("node:test");
const assert = require("node:assert/strict");
const {
    clearSrcModules,
    mockModule
} = require("./helpers/http");

const loadService = ({ plan = "FREE", currentCount = 0 }) => {
    clearSrcModules();
    const calls = [];
    const tx = {
        $queryRaw: async () => {
            calls.push("lock");
            return [{ org_id: 42 }];
        },
        organization: {
            findUnique: async () => {
                calls.push("plan");
                return { plan: { title: plan } };
            }
        },
        event: {
            count: async () => {
                calls.push("count");
                return currentCount;
            },
            create: async ({ data }) => {
                calls.push("create");
                return { event_id: 1, ...data };
            }
        }
    };
    let transactionOptions = null;
    mockModule("src/prisma/client", {
        $transaction: async (callback, options) => {
            transactionOptions = options;
            return callback(tx);
        }
    });

    const service = require("../src/services/organization_quota.service");
    return {
        ...service,
        calls,
        tx,
        getTransactionOptions: () => transactionOptions
    };
};

test("withOrganizationQuota locks, counts and creates in one serializable transaction", async () => {
    const service = loadService({ currentCount: 2 });

    const created = await service.withOrganizationQuota({
        organizationId: 42,
        limitKey: "maxEvents",
        resourceName: "d'événements",
        count: (tx) => tx.event.count(),
        create: (tx) => tx.event.create({ data: { title: "Concert" } })
    });

    assert.equal(created.title, "Concert");
    assert.deepEqual(service.calls, ["lock", "plan", "count", "create"]);
    assert.equal(service.getTransactionOptions().isolationLevel, "Serializable");
});

test("withOrganizationQuota rolls back before creation when the Free quota is reached", async () => {
    const service = loadService({ currentCount: 3 });

    await assert.rejects(
        service.withOrganizationQuota({
            organizationId: 42,
            limitKey: "maxEvents",
            resourceName: "d'événements",
            count: (tx) => tx.event.count(),
            create: (tx) => tx.event.create({ data: { title: "Too much" } })
        }),
        (error) => {
            assert.equal(error.code, "PLAN_QUOTA_EXCEEDED");
            assert.equal(error.currentCount, 3);
            assert.equal(error.limit, 3);
            return true;
        }
    );

    assert.deepEqual(service.calls, ["lock", "plan", "count"]);
});

test("withOrganizationQuota retries serialization conflicts", async () => {
    clearSrcModules();
    let attempts = 0;
    const tx = {
        $queryRaw: async () => [],
        organization: {
            findUnique: async () => ({ plan: { title: "PRO" } })
        },
        event: {
            count: async () => 30,
            create: async () => ({ event_id: 1 })
        }
    };
    mockModule("src/prisma/client", {
        $transaction: async (callback) => {
            attempts += 1;
            if (attempts === 1) {
                const error = new Error("Serialization conflict");
                error.code = "P2034";
                throw error;
            }
            return callback(tx);
        }
    });
    const { withOrganizationQuota } = require("../src/services/organization_quota.service");

    const result = await withOrganizationQuota({
        organizationId: 42,
        limitKey: "maxEvents",
        resourceName: "d'événements",
        count: (client) => client.event.count(),
        create: (client) => client.event.create({ data: {} })
    });

    assert.equal(result.event_id, 1);
    assert.equal(attempts, 2);
});

test("two concurrent Free creations cannot consume the same remaining slot", async () => {
    clearSrcModules();
    let activeEvents = 2;
    let nextEventId = 1;
    let transactionQueue = Promise.resolve();

    mockModule("src/prisma/client", {
        $transaction: async (callback) => {
            const previousTransaction = transactionQueue;
            let releaseTransaction;
            transactionQueue = new Promise((resolve) => {
                releaseTransaction = resolve;
            });

            await previousTransaction;
            const tx = {
                $queryRaw: async () => [{ org_id: 42 }],
                organization: {
                    findUnique: async () => ({ plan: { title: "FREE" } })
                },
                event: {
                    count: async () => activeEvents,
                    create: async ({ data }) => {
                        activeEvents += 1;
                        return { event_id: nextEventId++, ...data };
                    }
                }
            };

            try {
                return await callback(tx);
            } finally {
                releaseTransaction();
            }
        }
    });
    const { withOrganizationQuota } = require("../src/services/organization_quota.service");
    const createEvent = (title) => withOrganizationQuota({
        organizationId: 42,
        limitKey: "maxEvents",
        resourceName: "d'événements",
        count: (client) => client.event.count(),
        create: (client) => client.event.create({ data: { title } })
    });

    const results = await Promise.allSettled([
        createEvent("Concurrent A"),
        createEvent("Concurrent B")
    ]);

    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    assert.equal(results.find(result => result.status === "rejected").reason.code, "PLAN_QUOTA_EXCEEDED");
    assert.equal(activeEvents, 3);
});
