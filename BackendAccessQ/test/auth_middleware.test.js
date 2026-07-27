const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockPackage } = require("./helpers/http");

const loadAuthMiddleware = (verify) => {
    clearSrcModules();
    mockPackage("jsonwebtoken", { verify });
    return require("../src/middleware/authMiddleware");
};

const makeResponse = () => {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        sendStatus(code) {
            this.statusCode = code;
            return this;
        }
    };
};

test("authMiddleware accepts only access tokens", () => {
    const authMiddleware = loadAuthMiddleware((token, publicKey, options, callback) => {
        callback(null, { user_id: 7, role: "ORG_ADMIN", org_id: 42, token_type: "access" });
    });
    const req = { headers: { authorization: "Bearer access-token" }, cookies: {} };
    const res = makeResponse();
    let nextCalled = false;

    authMiddleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.user_id, 7);
    assert.equal(res.statusCode, null);
});

test("authMiddleware rejects refresh tokens on protected routes", () => {
    const authMiddleware = loadAuthMiddleware((token, publicKey, options, callback) => {
        callback(null, { user_id: 7, role: "ORG_ADMIN", org_id: 42, token_type: "refresh" });
    });
    const req = { headers: { authorization: "Bearer refresh-token" }, cookies: {} };
    const res = makeResponse();
    let nextCalled = false;

    authMiddleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});

test("authMiddleware rejects missing tokens", () => {
    const authMiddleware = loadAuthMiddleware(() => {
        throw new Error("verify should not be called");
    });
    const req = { headers: {}, cookies: {} };
    const res = makeResponse();

    authMiddleware(req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, "Accès refusé. Token manquant.");
});

test("authMiddleware allows operators to use scanner and password routes", () => {
    const authMiddleware = loadAuthMiddleware((token, publicKey, options, callback) => {
        callback(null, { user_id: 9, role: "OPERATOR", org_id: 42, token_type: "access" });
    });

    for (const [method, originalUrl] of [
        ["GET", "/user/profile"],
        ["PUT", "/user/password"],
        ["GET", "/user/logout"],
        ["GET", "/areas?active=true"],
        ["POST", "/qr/verify"]
    ]) {
        const req = {
            method,
            originalUrl,
            headers: { authorization: "Bearer access-token" },
            cookies: {}
        };
        const res = makeResponse();
        let nextCalled = false;

        authMiddleware(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true, `${method} ${originalUrl} should be allowed`);
        assert.equal(res.statusCode, null);
    }
});

test("authMiddleware blocks operators from management routes", () => {
    const authMiddleware = loadAuthMiddleware((token, publicKey, options, callback) => {
        callback(null, { user_id: 9, role: "OPERATOR", org_id: 42, token_type: "access" });
    });
    const req = {
        method: "GET",
        originalUrl: "/events",
        headers: { authorization: "Bearer access-token" },
        cookies: {}
    };
    const res = makeResponse();
    let nextCalled = false;

    authMiddleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /uniquement scanner/);
});
