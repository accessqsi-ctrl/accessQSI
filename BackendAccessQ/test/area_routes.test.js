const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const FREE_PLAN_CONTEXT = {
    plan: "FREE",
    planName: "Free",
    isPro: false,
    limits: { maxEvents: 3, maxQrCodes: 100, maxAgents: 4, maxAreas: 4 }
};

const loadAreaApp = ({ user, areaService, planContext = FREE_PLAN_CONTEXT }) => {
    clearSrcModules();
    const serviceWithDefaults = {
        countActiveForOrg: async () => 0,
        ...areaService
    };
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/area.service", serviceWithDefaults);
    mockModule("src/utils/planAccess", {
        getPlanContextForUser: async () => planContext
    });
    mockModule("src/services/organization_quota.service", {
        withOrganizationQuota: async ({ limitKey, create }) => {
            const currentCount = await serviceWithDefaults.countActiveForOrg(user.org_id);
            const limit = planContext.limits[limitKey];
            if (limit !== null && limit !== undefined && currentCount >= limit) {
                throw {
                    code: "PLAN_QUOTA_EXCEEDED",
                    currentCount,
                    limit,
                    plan: planContext.plan,
                    planName: planContext.planName
                };
            }
            return create({});
        }
    });

    const router = require("../src/routes/area.routes");
    return mountRouter("/areas", router);
};

test("GET /areas returns areas for the authenticated organization", async () => {
    let receivedOrgId = null;
    const app = loadAreaApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        areaService: {
            findAll: async (orgId) => {
                receivedOrgId = orgId;
                return [{ area_id: 1, area_name: "VIP", accreditation_level: 3, org_id: orgId }];
            }
        }
    });

    const res = await request(app, "GET", "/areas");

    assert.equal(res.status, 200);
    assert.equal(receivedOrgId, 42);
    assert.equal(res.body.success, true);
    assert.equal(res.body.areas[0].area_name, "VIP");
});

test("POST /areas rejects non-admin users", async () => {
    let createCalled = false;
    const app = loadAreaApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        areaService: {
            createArea: async () => {
                createCalled = true;
            }
        }
    });

    const res = await request(app, "POST", "/areas", {
        area_name: "Backstage",
        accreditation_level: 2
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);
});

test("POST /areas allows admins and attaches the authenticated organization", async () => {
    let receivedData = null;
    const app = loadAreaApp({
        user: { user_id: 7, role: "SUPER_ADMIN", org_id: 42 },
        areaService: {
            createArea: async (data) => {
                receivedData = data;
                return { area_id: 9, ...data };
            }
        }
    });

    const res = await request(app, "POST", "/areas", {
        area_name: "Backstage",
        accreditation_level: "2"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.deepEqual(receivedData, {
        area_name: "Backstage",
        accreditation_level: 2,
        org_id: 42
    });
});

test("POST /areas refuses a fifth active area on the Free plan", async () => {
    let createCalled = false;
    const app = loadAreaApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        areaService: {
            countActiveForOrg: async () => 4,
            createArea: async () => {
                createCalled = true;
            }
        }
    });

    const res = await request(app, "POST", "/areas", {
        area_name: "Zone 5",
        accreditation_level: 1
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.upgradeRequired, true);
    assert.match(res.body.message, /4\/4/);
    assert.equal(createCalled, false);
});

test("POST /areas keeps areas unlimited on the Pro plan", async () => {
    let createCalled = false;
    const app = loadAreaApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        planContext: {
            plan: "PRO",
            planName: "Pro",
            isPro: true,
            limits: { maxEvents: null, maxQrCodes: null, maxAgents: null, maxAreas: null }
        },
        areaService: {
            countActiveForOrg: async () => 20,
            createArea: async (data) => {
                createCalled = true;
                return { area_id: 21, ...data };
            }
        }
    });

    const res = await request(app, "POST", "/areas", {
        area_name: "Pro Zone",
        accreditation_level: 2
    });

    assert.equal(res.status, 201);
    assert.equal(createCalled, true);
});

test("PUT /areas/:id refuses updates for areas outside the organization", async () => {
    let updateCalled = false;
    const app = loadAreaApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        areaService: {
            findById: async () => null,
            updateArea: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/areas/123", { area_name: "New name" });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(updateCalled, false);
});

test("DELETE /areas/:id soft-deletes an organization area", async () => {
    let deletedAreaId = null;
    const app = loadAreaApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        areaService: {
            findById: async (orgId, areaId) => ({ area_id: areaId, org_id: orgId }),
            deleteArea: async (areaId) => {
                deletedAreaId = areaId;
                return { area_id: areaId, deleted_at: new Date() };
            }
        }
    });

    const res = await request(app, "DELETE", "/areas/12");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(deletedAreaId, 12);
});
