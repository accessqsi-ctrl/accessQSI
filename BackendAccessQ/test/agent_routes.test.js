const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const loadAgentApp = ({ user, agentService, userService = {}, emailService = {} }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/agent.service", agentService);
    mockModule("src/services/user.service", userService);
    mockModule("src/services/email.service", {
        sendAgentInvitation: async () => {},
        ...emailService
    });

    const router = require("../src/routes/agent.routes");
    return mountRouter("/agents", router);
};

test("GET /agents returns formatted agents for the authenticated organization", async () => {
    let receivedOrgId = null;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_AGENT", org_id: 42 },
        agentService: {
            getAllAgentsForOrg: async (orgId) => {
                receivedOrgId = orgId;
                return [{
                    user_id: 2,
                    full_name: "Alice Agent",
                    email: "alice@example.com",
                    role: "ORG_AGENT",
                    deleted_at: null,
                    created_at: new Date("2026-01-01T00:00:00Z"),
                    last_login: null,
                    _count: { scan_logs: 5 }
                }];
            }
        }
    });

    const res = await request(app, "GET", "/agents");

    assert.equal(res.status, 200);
    assert.equal(receivedOrgId, 42);
    assert.equal(res.body.success, true);
    assert.equal(res.body.agents[0].name, "Alice Agent");
    assert.equal(res.body.agents[0].scans, 5);
});

test("POST /agents/add-agent rejects duplicate email", async () => {
    let createCalled = false;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        agentService: {
            createAgent: async () => {
                createCalled = true;
            }
        },
        userService: {
            findByEmail: async () => ({ user_id: 99 })
        }
    });

    const res = await request(app, "POST", "/agents/add-agent", {
        fullName: "Alice Agent",
        email: "alice@example.com",
        password: "Strong!123"
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);
});

test("POST /agents/add-agent creates an operator in the authenticated organization", async () => {
    let createdArgs = null;
    let invitation = null;
    const app = loadAgentApp({
        user: { user_id: 7, role: "SUPER_ADMIN", org_id: 42 },
        agentService: {
            createAgent: async (...args) => {
                createdArgs = args;
                return { user_id: 10 };
            }
        },
        userService: {
            findByEmail: async () => null
        },
        emailService: {
            sendAgentInvitation: async (...args) => {
                invitation = args;
            }
        }
    });

    const res = await request(app, "POST", "/agents/add-agent", {
        fullName: "Olivia Operator",
        email: "olivia@example.com",
        role: "OPERATOR",
        password: "Strong!123"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(createdArgs[0], 42);
    assert.equal(createdArgs[1], "Olivia Operator");
    assert.equal(createdArgs[2], "olivia@example.com");
    assert.equal(createdArgs[4], "OPERATOR");
    assert.deepEqual(invitation, ["olivia@example.com", "Olivia Operator", "Strong!123"]);
});

test("PUT /agents/:id/toggle refuses to revoke organization admins", async () => {
    let updateCalled = false;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        agentService: {
            getAgentByIdAndOrg: async () => ({ user_id: 2, org_id: 42, role: "ORG_ADMIN", deleted_at: null }),
            updateAgentStatus: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/agents/2/toggle");

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(updateCalled, false);
});

test("DELETE /agents/:id soft-deletes agents to preserve scan history", async () => {
    let softDeleted = null;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        agentService: {
            getAgentByIdAndOrg: async () => ({ user_id: 2, org_id: 42, role: "ORG_AGENT", deleted_at: null }),
            softDeleteAgent: async (agentId, orgId) => {
                softDeleted = { agentId, orgId };
            }
        }
    });

    const res = await request(app, "DELETE", "/agents/2");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(softDeleted, { agentId: 2, orgId: 42 });
});
