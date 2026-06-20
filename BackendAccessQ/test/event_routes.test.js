const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const loadEventApp = ({ user, eventService }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/event.service", eventService);

    const router = require("../src/routes/event.routes");
    return mountRouter("/events", router);
};

test("GET /events returns events scoped to the authenticated organization", async () => {
    let receivedOrgId = null;
    const app = loadEventApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        eventService: {
            findAll: async (orgId) => {
                receivedOrgId = orgId;
                return [{
                    event_id: 1,
                    title: "Concert",
                    EventSchedules: [{
                        start_date: new Date("2026-01-01T10:00:00Z"),
                        end_date: new Date("2026-01-01T22:00:00Z"),
                        area: { area_name: "VIP" }
                    }],
                    _count: { qr_codes: 3 }
                }];
            },
            findByTitle: async () => []
        }
    });

    const res = await request(app, "GET", "/events");

    assert.equal(res.status, 200);
    assert.equal(receivedOrgId, 42);
    assert.equal(res.body.success, true);
    assert.equal(res.body.events[0].name, "Concert");
    assert.equal(res.body.events[0].location, "VIP");
    assert.equal(res.body.events[0].qrs, 3);
});

test("POST /events rejects non-admin users before creating an event", async () => {
    let createCalled = false;
    const app = loadEventApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        eventService: {
            findAll: async () => [],
            findByTitle: async () => [],
            createEvent: async () => {
                createCalled = true;
            }
        }
    });

    const res = await request(app, "POST", "/events", {
        title: "Concert",
        startDate: "2026-01-01T10:00:00Z",
        endDate: "2026-01-01T22:00:00Z"
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);
});

test("POST /events allows ORG_ADMIN and does not pass unknown location field to Prisma data", async () => {
    let receivedData = null;
    const app = loadEventApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        eventService: {
            findAll: async () => [],
            findByTitle: async () => [],
            createEvent: async (data) => {
                receivedData = data;
                return { event_id: 9, ...data };
            }
        }
    });

    const res = await request(app, "POST", "/events", {
        title: "Concert",
        description: "Main hall",
        location: "Should be ignored",
        areaIds: [2],
        startDate: "2026-01-01T10:00:00Z",
        endDate: "2026-01-01T22:00:00Z"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(receivedData.org_id, 42);
    assert.equal(receivedData.title, "Concert");
    assert.equal(Object.hasOwn(receivedData, "location"), false);
});
