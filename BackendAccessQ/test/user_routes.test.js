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
        signinLimiter: passThroughLimiter,
        refreshLimiter: passThroughLimiter,
        verificationEmailLimiter: passThroughLimiter,
        passwordResetLimiter: passThroughLimiter
    });
    mockModule("src/services/user.service", userService);
    mockModule("src/services/email.service", {
        sendVerificationEmail: async () => {},
        sendAgentInvitation: async () => {},
        sendPasswordResetEmail: async () => true,
        ...emailService
    });
    mockModule("src/prisma/client", {
        ...prisma,
        userQ: {
            findFirst: async () => null,
            findUnique: async ({ where }) => ({
                user_id: where.user_id,
                email: "admin@example.com",
                role: "ORG_ADMIN",
                org_id: 42,
                is_active: true,
                deleted_at: null,
                organization: { org_id: 42, is_active: true, deleted_at: null }
            }),
            count: async () => 0,
            update: async () => ({}),
            updateMany: async () => ({ count: 0 }),
            ...(prisma.userQ || {})
        },
        event: {
            count: async () => 0,
            ...(prisma.event || {})
        },
        qrCode: {
            count: async () => 0,
            ...(prisma.qrCode || {})
        },
        area: {
            count: async () => 0,
            ...(prisma.area || {})
        },
        organization: {
            findUnique: async () => ({ org_id: 42, is_active: true, deleted_at: null }),
            ...(prisma.organization || {})
        }
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

test("POST /user/forgot-password returns the same response for an unknown email", async () => {
    const app = loadUserApp({ userService: { findByEmail: async () => null } });

    const res = await request(app, "POST", "/user/forgot-password", { email: "unknown@example.com" });

    assert.equal(res.status, 202);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /Si un compte actif/);
});

test("POST /user/forgot-password stores only a token hash and sends the raw token", async () => {
    const updates = [];
    let emailedToken = null;
    const app = loadUserApp({
        userService: {
            findByEmail: async () => ({
                user_id: 7,
                email: "admin@example.com",
                full_name: "Admin",
                deleted_at: null,
                is_active: true,
                password_reset_email_sent_at: null
            })
        },
        emailService: {
            sendPasswordResetEmail: async (email, name, token) => {
                emailedToken = token;
                return true;
            }
        },
        prisma: {
            userQ: { update: async (args) => { updates.push(args); return {}; } }
        }
    });

    const res = await request(app, "POST", "/user/forgot-password", { email: " Admin@Example.COM " });

    assert.equal(res.status, 202);
    assert.equal(emailedToken.length, 64);
    assert.notEqual(updates[0].data.password_reset_token_hash, emailedToken);
    assert.equal(updates[0].data.password_reset_token_hash.length, 64);
    assert.ok(updates[0].data.password_reset_expires_at instanceof Date);
    assert.ok(updates[1].data.password_reset_email_sent_at instanceof Date);
});

test("POST /user/reset-password consumes a valid token and saves the new hash", async () => {
    let findWhere = null;
    let updateArgs = null;
    const app = loadUserApp({
        prisma: {
            userQ: {
                findFirst: async ({ where }) => {
                    findWhere = where;
                    return { user_id: 7, org_id: 42 };
                },
                updateMany: async (args) => {
                    updateArgs = args;
                    return { count: 1 };
                }
            }
        },
        bcrypt: { hash: async (password) => `hashed:${password}` }
    });

    const res = await request(app, "POST", "/user/reset-password", {
        token: "raw-reset-token",
        password: "NewStrong!123"
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(findWhere.password_reset_token_hash.length, 64);
    assert.notEqual(findWhere.password_reset_token_hash, "raw-reset-token");
    assert.equal(updateArgs.data.password_hash, "hashed:NewStrong!123");
    assert.equal(updateArgs.data.password_reset_token_hash, null);
    assert.equal(updateArgs.data.password_reset_expires_at, null);
});

test("POST /user/reset-password rejects an expired or already used token", async () => {
    const app = loadUserApp({ prisma: { userQ: { findFirst: async () => null } } });

    const res = await request(app, "POST", "/user/reset-password", {
        token: "expired-token",
        password: "NewStrong!123"
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /invalide ou expiré/);
});

test("POST /user/login returns a token for verified active users", async () => {
    const signPayloads = [];
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
                signPayloads.push(payload);
                return `${payload.token_type}-signed-token`;
            }
        }
    });

    const res = await request(app, "POST", "/user/login", {
        email: "admin@example.com",
        password: "Strong!123"
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.token, "access-signed-token");
    assert.deepEqual(signPayloads[0], {
        user_id: 7,
        email: "admin@example.com",
        role: "ORG_ADMIN",
        org_id: 42,
        token_type: "access"
    });
    assert.deepEqual(signPayloads[1], {
        user_id: 7,
        email: "admin@example.com",
        role: "ORG_ADMIN",
        org_id: 42,
        token_type: "refresh"
    });
});

test("POST /user/login rejects a valid password when the account is disabled", async () => {
    const app = loadUserApp({
        userService: {
            findByEmail: async () => ({
                user_id: 7, full_name: "Disabled User", email: "disabled@example.com",
                password_hash: "stored-hash", role: "ORG_AGENT", org_id: 42,
                is_verified: true, deleted_at: null
            })
        },
        prisma: {
            userQ: {
                findUnique: async () => ({
                    user_id: 7, email: "disabled@example.com", role: "ORG_AGENT", org_id: 42,
                    is_active: false, deleted_at: null,
                    organization: { org_id: 42, is_active: true, deleted_at: null }
                })
            }
        }
    });
    const res = await request(app, "POST", "/user/login", { email: "disabled@example.com", password: "Strong!123" });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "ACCOUNT_DISABLED");
});

test("POST /user/login rejects users of a disabled organization", async () => {
    const app = loadUserApp({
        userService: {
            findByEmail: async () => ({
                user_id: 7, full_name: "Agent", email: "agent@example.com",
                password_hash: "stored-hash", role: "ORG_AGENT", org_id: 42,
                is_verified: true, deleted_at: null
            })
        },
        prisma: {
            userQ: {
                findUnique: async () => ({
                    user_id: 7, email: "agent@example.com", role: "ORG_AGENT", org_id: 42,
                    is_active: true, deleted_at: null,
                    organization: { org_id: 42, is_active: false, deleted_at: null }
                })
            }
        }
    });
    const res = await request(app, "POST", "/user/login", { email: "agent@example.com", password: "Strong!123" });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "ORGANIZATION_DISABLED");
});

test("POST /user/login returns the Essential welcome offer only on the first login", async () => {
    let lastLoginUpdate = null;
    const expiry = new Date("2026-09-26T10:00:00Z");
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
                deleted_at: null,
                last_login: null
            })
        },
        prisma: {
            organization: {
                findUnique: async () => ({
                    org_id: 42,
                    plan: { title: "ESSENTIAL" },
                    subscription_started_at: new Date("2026-08-26T10:00:00Z"),
                    subscription_expires_at: expiry,
                    trial_started_at: new Date("2026-08-26T10:00:00Z"),
                    trial_expires_at: expiry
                })
            },
            userQ: {
                update: async (args) => {
                    lastLoginUpdate = args;
                    return {};
                }
            }
        }
    });

    const res = await request(app, "POST", "/user/login", {
        email: "admin@example.com",
        password: "Strong!123"
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.welcomeOffer.plan, "ESSENTIAL");
    assert.equal(res.body.welcomeOffer.expiresAt, expiry.toISOString());
    assert.equal(res.body.welcomeOffer.features.length > 0, true);
    assert.deepEqual(lastLoginUpdate.where, { user_id: 7 });
    assert.ok(lastLoginUpdate.data.last_login instanceof Date);
});

test("POST /user/login does not return the welcome offer after the first login", async () => {
    let organizationLookupCalled = false;
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
                deleted_at: null,
                last_login: new Date("2026-08-26T10:00:00Z")
            })
        },
        prisma: {
            organization: {
                findUnique: async () => {
                    organizationLookupCalled = true;
                    return null;
                }
            }
        }
    });

    const res = await request(app, "POST", "/user/login", {
        email: "admin@example.com",
        password: "Strong!123"
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.welcomeOffer, null);
    assert.equal(organizationLookupCalled, false);
});

test("POST /user/login normalizes email casing and surrounding spaces", async () => {
    let lookedUpEmail;
    const app = loadUserApp({
        userService: {
            findByEmail: async (email) => {
                lookedUpEmail = email;
                return {
                    user_id: 7,
                    full_name: "Admin User",
                    email: "admin@example.com",
                    password_hash: "stored-hash",
                    role: "ORG_ADMIN",
                    org_id: 42,
                    is_verified: true,
                    deleted_at: null
                };
            }
        }
    });

    const res = await request(app, "POST", "/user/login", {
        email: "  Admin@Example.COM ",
        password: "Strong!123"
    });

    assert.equal(res.status, 200);
    assert.equal(lookedUpEmail, "admin@example.com");
});

test("POST /user/login tolerates outer spaces removed by historical signup", async () => {
    const comparedPasswords = [];
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
            compare: async (password) => {
                comparedPasswords.push(password);
                return password === "Strong!123";
            }
        }
    });

    const res = await request(app, "POST", "/user/login", {
        email: "admin@example.com",
        password: " Strong!123 "
    });

    assert.equal(res.status, 200);
    assert.deepEqual(comparedPasswords, [" Strong!123 ", "Strong!123"]);
});

test("POST /user/refresh issues a new short-lived access token from a refresh token", async () => {
    const signPayloads = [];
    const app = loadUserApp({
        jwt: {
            verify: (token, publicKey, options, callback) => {
                callback(null, {
                    user_id: 7,
                    email: "admin@example.com",
                    role: "ORG_ADMIN",
                    org_id: 42,
                    token_type: "refresh"
                });
            },
            sign: (payload) => {
                signPayloads.push(payload);
                return `${payload.token_type}-signed-token`;
            }
        }
    });

    const res = await request(
        app,
        "POST",
        "/user/refresh",
        {},
        { cookies: { refreshToken: "valid-refresh-token" } }
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.token, "access-signed-token");
    assert.equal(signPayloads[0].token_type, "access");
    assert.equal(signPayloads[1].token_type, "refresh");
});

test("POST /user/refresh rejects missing refresh token", async () => {
    const app = loadUserApp();

    const res = await request(app, "POST", "/user/refresh", {});

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
});

test("POST /user/refresh cannot renew a disabled account session", async () => {
    let signCalled = false;
    const app = loadUserApp({
        prisma: {
            userQ: {
                findUnique: async () => ({
                    user_id: 7, email: "agent@example.com", role: "ORG_AGENT", org_id: 42,
                    is_active: false, deleted_at: null,
                    organization: { org_id: 42, is_active: true, deleted_at: null }
                })
            }
        },
        jwt: {
            verify: (token, publicKey, options, callback) => callback(null, {
                user_id: 7, email: "agent@example.com", role: "ORG_AGENT", org_id: 42, token_type: "refresh"
            }),
            sign: () => { signCalled = true; return "unexpected-token"; }
        }
    });
    const res = await request(app, "POST", "/user/refresh", {}, { cookies: { refreshToken: "valid-refresh-token" } });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "ACCOUNT_DISABLED");
    assert.equal(signCalled, false);
});

test("POST /user/refresh rejects non-refresh tokens", async () => {
    let signCalled = false;
    const app = loadUserApp({
        jwt: {
            verify: (token, publicKey, options, callback) => {
                callback(null, {
                    user_id: 7,
                    email: "admin@example.com",
                    role: "ORG_ADMIN",
                    org_id: 42,
                    token_type: "access"
                });
            },
            sign: () => {
                signCalled = true;
                return "signed-token";
            }
        }
    });

    const res = await request(
        app,
        "POST",
        "/user/refresh",
        {},
        { cookies: { refreshToken: "access-token-used-as-refresh" } }
    );

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(signCalled, false);
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
        data: { is_verified: true, verification_token: null, verification_token_expires_at: null }
    });
});

test("POST /user/resend-verification rotates the token and sends a new email", async () => {
    const updates = [];
    let sentToken = null;
    const app = loadUserApp({
        userService: { findByEmail: async () => ({ user_id: 7, email: "admin@example.com", full_name: "Admin", is_verified: false, verification_email_sent_at: null }) },
        prisma: { userQ: { update: async (args) => { updates.push(args); return {}; } } },
        emailService: { sendVerificationEmail: async (email, name, token) => { sentToken = token; return true; } }
    });
    const res = await request(app, "POST", "/user/resend-verification", { email: "admin@example.com" });
    assert.equal(res.status, 202);
    assert.equal(res.body.success, true);
    assert.equal(typeof sentToken, "string");
    assert.equal(updates[0].data.verification_token, sentToken);
    assert.ok(updates[0].data.verification_token_expires_at instanceof Date);
    assert.ok(updates[1].data.verification_email_sent_at instanceof Date);
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
            },
            organization: {
                findUnique: async () => ({
                    org_id: 42,
                    name: "Example Org",
                    plan: { title: "PRO" }
                })
            },
            event: { count: async () => 2 },
            qrCode: { groupBy: async () => [{ event_id: 1, _count: { _all: 15 } }] },
            area: { count: async () => 3 }
        }
    });

    const res = await request(app, "GET", "/user/profile");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(receivedWhere, { user_id: 12 });
    assert.equal(res.body.user.email, "agent@example.com");
    assert.equal(res.body.user.plan, "PRO");
    assert.equal(res.body.user.planName, "Pro");
    assert.equal(res.body.user.isPro, true);
    assert.equal(res.body.user.planLimits.maxEventsPerCycle, 10);
    assert.equal(res.body.user.planLimits.maxQrCodesPerEvent, 700);
    assert.equal(res.body.user.planLimits.maxAgents, 15);
    assert.equal(res.body.user.planLimits.maxAreas, 20);
    assert.deepEqual(res.body.user.planUsage.events, { used: 2, limit: 10, remaining: 8, reached: false });
    assert.deepEqual(res.body.user.planUsage.qrCodes, { used: 15, limit: 700, remaining: 685, reached: false });
    assert.equal(res.body.user.subscription.subscriptionType, "PAID");
    assert.equal(res.body.user.subscription.planCapabilities.includes("advanced_analytics"), true);
});

test("PUT /user/profile rejects an email already used by another user", async () => {
    let updateCalled = false;
    const app = loadUserApp({
        user: { user_id: 12, role: "ORG_ADMIN", org_id: 42 },
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

test("PUT /user/profile prevents an organization agent from changing email", async () => {
    let updateCalled = false;
    const app = loadUserApp({
        user: { user_id: 12, role: "ORG_AGENT", org_id: 42 },
        prisma: {
            userQ: {
                findUnique: async () => ({ email: "agent@example.com" })
            }
        },
        userService: {
            updateUser: async () => {
                updateCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/user/profile", {
        fullName: "Agent User",
        email: "new-agent@example.com"
    });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /ne peut pas modifier son adresse e-mail/i);
    assert.equal(updateCalled, false);
});

test("PUT /user/profile lets an organization agent update only their name", async () => {
    let updateArgs = null;
    const app = loadUserApp({
        user: { user_id: 12, role: "ORG_AGENT", org_id: 42 },
        prisma: {
            userQ: {
                findUnique: async () => ({ email: "agent@example.com" })
            }
        },
        userService: {
            updateUser: async (userId, data) => {
                updateArgs = { userId, data };
                return {
                    user_id: userId,
                    full_name: data.full_name,
                    email: "agent@example.com"
                };
            }
        }
    });

    const res = await request(app, "PUT", "/user/profile", {
        fullName: "Agent Renommé"
    });

    assert.equal(res.status, 200);
    assert.deepEqual(updateArgs, {
        userId: 12,
        data: { full_name: "Agent Renommé" }
    });
    assert.equal(res.body.user.email, "agent@example.com");
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

test("GET /user/logout clears access and refresh cookies", async () => {
    const app = loadUserApp();

    const res = await request(app, "GET", "/user/logout");
    const cookies = Array.isArray(res.headers["set-cookie"])
        ? res.headers["set-cookie"]
        : [res.headers["set-cookie"]];

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(cookies.some((cookie) => cookie.startsWith("token=")), true);
    assert.equal(cookies.some((cookie) => cookie.startsWith("refreshToken=")), true);
});
