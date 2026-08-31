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

const loadAgentApp = ({
    user,
    agentService,
    userService = {},
    emailService = {},
    planContext = FREE_PLAN_CONTEXT
}) => {
    clearSrcModules();
    const serviceWithDefaults = {
        countActiveAgentsForOrg: async () => 0,
        ...agentService
    };
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/agent.service", serviceWithDefaults);
    mockModule("src/services/user.service", userService);
    mockModule("src/services/email.service", {
        sendAgentInvitation: async () => {},
        ...emailService
    });
    mockModule("src/utils/planAccess", {
        getPlanContextForUser: async () => planContext
    });
    mockModule("src/services/organization_quota.service", {
        withOrganizationQuota: async ({ limitKey, create }) => {
            const currentCount = await serviceWithDefaults.countActiveAgentsForOrg(user.org_id);
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
    assert.equal(res.body.agents[0].rawRole, "ORG_AGENT");
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

test("POST /agents/add-agent refuses a fifth active agent on the Free plan", async () => {
    let createCalled = false;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        agentService: {
            countActiveAgentsForOrg: async () => 4,
            createAgent: async () => {
                createCalled = true;
            }
        },
        userService: {
            findByEmail: async () => null
        }
    });

    const res = await request(app, "POST", "/agents/add-agent", {
        fullName: "Fifth Agent",
        email: "fifth@example.com",
        password: "Strong!123"
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.upgradeRequired, true);
    assert.match(res.body.message, /4\/4/);
    assert.equal(createCalled, false);
});

test("POST /agents/add-agent keeps agents unlimited on the Pro plan", async () => {
    let createCalled = false;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        planContext: {
            plan: "PRO",
            planName: "Pro",
            isPro: true,
            limits: { maxEvents: null, maxQrCodes: null, maxAgents: null, maxAreas: null }
        },
        agentService: {
            countActiveAgentsForOrg: async () => 25,
            createAgent: async () => {
                createCalled = true;
                return { user_id: 30 };
            }
        },
        userService: {
            findByEmail: async () => null
        }
    });

    const res = await request(app, "POST", "/agents/add-agent", {
        fullName: "Pro Agent",
        email: "pro-agent@example.com",
        password: "Strong!123"
    });

    assert.equal(res.status, 201);
    assert.equal(createCalled, true);
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

test("PUT /agents/:id/toggle refuses to change the current user's own access", async () => {
    let lookupCalled = false;
    let updateCalled = false;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        agentService: {
            getAgentByIdAndOrg: async () => {
                lookupCalled = true;
            },
            updateAgentStatus: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/agents/7/toggle");

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(lookupCalled, false);
    assert.equal(updateCalled, false);
});

test("PUT /agents/:id/toggle refuses to restore a fifth Free agent", async () => {
    let updateCalled = false;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        agentService: {
            getAgentByIdAndOrg: async () => ({
                user_id: 2,
                org_id: 42,
                role: "ORG_AGENT",
                deleted_at: new Date()
            }),
            countActiveAgentsForOrg: async () => 4,
            updateAgentStatus: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/agents/2/toggle");

    assert.equal(res.status, 403);
    assert.equal(res.body.upgradeRequired, true);
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

test("DELETE /agents/:id refuses to delete the current user's own account", async () => {
    let lookupCalled = false;
    let softDeleteCalled = false;
    const app = loadAgentApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        agentService: {
            getAgentByIdAndOrg: async () => {
                lookupCalled = true;
            },
            softDeleteAgent: async () => {
                softDeleteCalled = true;
            }
        }
    });

    const res = await request(app, "DELETE", "/agents/7");

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(lookupCalled, false);
    assert.equal(softDeleteCalled, false);
});
