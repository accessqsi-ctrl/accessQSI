const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const loadAreaApp = ({ user, areaService }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/area.service", areaService);

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
