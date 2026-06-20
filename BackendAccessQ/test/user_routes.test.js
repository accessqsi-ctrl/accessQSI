const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mockPackage,
    mountRouter,
    request
} = require("./helpers/http");

const passThroughLimiter = (req, res, next) => next();

const loadUserApp = ({
    user = { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
    userService = {},
    emailService = {},
    prisma = {},
    bcrypt = {},
    jwt = {}
} = {}) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/middleware/limMiddleware", {
        generalLimiter: passThroughLimiter,
        loginLimiter: passThroughLimiter,
        signinLimiter: passThroughLimiter
    });
    mockModule("src/services/user.service", userService);
    mockModule("src/services/email.service", {
        sendVerificationEmail: async () => {},
        sendAgentInvitation: async () => {},
        ...emailService
    });
    mockModule("src/prisma/client", {
        userQ: {
            findFirst: async () => null,
            findUnique: async () => null,
            update: async () => ({}),
            ...(prisma.userQ || {})
        },
        ...prisma
    });
    mockPackage("bcrypt", {
        compare: async () => true,
        hash: async () => "hashed-password",
        ...bcrypt
    });
    mockPackage("jsonwebtoken", {
        sign: () => "signed-token",
        verify: () => ({}),
        ...jwt
    });

    const router = require("../src/routes/user.routes");
    return mountRouter("/user", router);
};

test("POST /user/login rejects missing credentials", async () => {
    const app = loadUserApp();

    const res = await request(app, "POST", "/user/login", { email: "admin@example.com" });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
});

test("POST /user/login returns a token for verified active users", async () => {
    let signPayload = null;
    const app = loadUserApp({
        userService: {
            findByEmail: async () => ({
                user_id: 7,
                full_name: "Admin User",
                email: "admin@example.com",
                password_hash: "stored-hash",
                role: "ORG_ADMIN",
                org_id: 42,
                is_verified: true,
                deleted_at: null
            })
        },
        bcrypt: {
            compare: async (password, hash) => password === "Strong!123" && hash === "stored-hash"
        },
        jwt: {
            sign: (payload) => {
                signPayload = payload;
                return "signed-token";
            }
        }
    });

    const res = await request(app, "POST", "/user/login", {
        email: "admin@example.com",
        password: "Strong!123"
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.token, "signed-token");
    assert.deepEqual(signPayload, {
        user_id: 7,
        email: "admin@example.com",
        role: "ORG_ADMIN",
        org_id: 42
    });
});

test("POST /user/signin creates an organization admin and sends a verification email", async () => {
    let created = null;
    let verificationEmail = null;
    const app = loadUserApp({
        userService: {
            findByEmail: async () => null,
            createOrgAndAdminUser: async (orgData, userData) => {
                created = { orgData, userData };
                return { org: { org_id: 42 }, user: { user_id: 7 } };
            }
        },
        emailService: {
            sendVerificationEmail: async (...args) => {
                verificationEmail = args;
            }
        },
        bcrypt: {
            hash: async (password) => `hashed:${password}`
        }
    });

    const res = await request(app, "POST", "/user/signin", {
        fullName: "Admin User",
        email: "admin@example.com",
        organizationName: "Access Org",
        password: "Strong!123"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.deepEqual(created.orgData, { name: "Access Org" });
    assert.equal(created.userData.full_name, "Admin User");
    assert.equal(created.userData.password_hash, "hashed:Strong!123");
    assert.equal(created.userData.role, "ORG_ADMIN");
    assert.equal(created.userData.is_verified, false);
    assert.equal(verificationEmail[0], "admin@example.com");
    assert.equal(verificationEmail[1], "Admin User");
    assert.equal(typeof verificationEmail[2], "string");
});

test("POST /user/signin rejects weak passwords before creating an account", async () => {
    let createCalled = false;
    const app = loadUserApp({
        userService: {
            findByEmail: async () => null,
            createOrgAndAdminUser: async () => {
                createCalled = true;
            }
        }
    });

    const res = await request(app, "POST", "/user/signin", {
        fullName: "Admin User",
        email: "admin@example.com",
        organizationName: "Access Org",
        password: "weak"
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);
});

test("POST /user/verify-email activates a user and clears the verification token", async () => {
    let updateArgs = null;
    const app = loadUserApp({
        prisma: {
            userQ: {
                findFirst: async ({ where }) => where.verification_token === "verify-token"
                    ? { user_id: 7 }
                    : null,
                update: async (args) => {
                    updateArgs = args;
                    return {};
                }
            }
        }
    });

    const res = await request(app, "POST", "/user/verify-email", { token: "verify-token" });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(updateArgs, {
        where: { user_id: 7 },
        data: { is_verified: true, verification_token: null }
    });
});

test("GET /user/profile returns the authenticated user profile", async () => {
    let receivedWhere = null;
    const app = loadUserApp({
        user: { user_id: 12, role: "ORG_AGENT", org_id: 42 },
        prisma: {
            userQ: {
                findUnique: async ({ where }) => {
                    receivedWhere = where;
                    return {
                        user_id: 12,
                        email: "agent@example.com",
                        full_name: "Agent User",
                        role: "ORG_AGENT",
                        org_id: 42
                    };
                }
            }
        }
    });

    const res = await request(app, "GET", "/user/profile");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(receivedWhere, { user_id: 12 });
    assert.equal(res.body.user.email, "agent@example.com");
});

test("PUT /user/profile rejects an email already used by another user", async () => {
    let updateCalled = false;
    const app = loadUserApp({
        user: { user_id: 12, role: "ORG_AGENT", org_id: 42 },
        userService: {
            findByEmail: async () => ({ user_id: 99 }),
            updateUser: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/user/profile", {
        fullName: "Agent User",
        email: "taken@example.com"
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(updateCalled, false);
});

test("PUT /user/password validates current password and saves a new hash", async () => {
    let updated = null;
    const app = loadUserApp({
        user: { user_id: 12, role: "ORG_AGENT", org_id: 42 },
        prisma: {
            userQ: {
                findUnique: async () => ({ user_id: 12, password_hash: "old-hash" })
            }
        },
        bcrypt: {
            compare: async (password, hash) => password === "Old!12345" && hash === "old-hash",
            hash: async (password) => `new-hash:${password}`
        },
        userService: {
            updateUser: async (userId, data) => {
                updated = { userId, data };
            }
        }
    });

    const res = await request(app, "PUT", "/user/password", {
        currentPassword: "Old!12345",
        newPassword: "NewStrong!123"
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(updated, {
        userId: 12,
        data: { password_hash: "new-hash:NewStrong!123" }
    });
});

test("PUT /user/org rejects non-admin users before updating organization", async () => {
    let updateCalled = false;
    const app = loadUserApp({
        user: { user_id: 12, role: "ORG_AGENT", org_id: 42 },
        userService: {
            updateOrganization: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/user/org", { name: "New Org" });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(updateCalled, false);
});

test("PUT /user/org allows admins to update their organization", async () => {
    let receivedOrgId = null;
    let receivedData = null;
    const app = loadUserApp({
        user: { user_id: 7, role: "SUPER_ADMIN", org_id: 42 },
        userService: {
            updateOrganization: async (orgId, data) => {
                receivedOrgId = orgId;
                receivedData = data;
            }
        }
    });

    const res = await request(app, "PUT", "/user/org", { name: "New Org" });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(receivedOrgId, 42);
    assert.deepEqual(receivedData, { name: "New Org" });
});
