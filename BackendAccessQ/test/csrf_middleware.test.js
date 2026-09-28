const test = require("node:test");
const assert = require("node:assert/strict");

const csrfProtection = require("../src/middleware/csrfMiddleware");

const response = () => ({
    statusCode: null,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

const request = ({ method = "POST", headers = {}, cookies = {} } = {}) => ({
    method,
    protocol: "https",
    cookies,
    get(name) {
        return headers[name.toLowerCase()];
    }
});

test("CSRF protection accepts safe methods and configured browser origins", () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "https://app.example.com";
    try {
        for (const req of [
            request({ method: "GET", cookies: { token: "session" } }),
            request({ headers: { origin: "https://app.example.com" }, cookies: { token: "session" } })
        ]) {
            let nextCalled = false;
            csrfProtection(req, response(), () => { nextCalled = true; });
            assert.equal(nextCalled, true);
        }
    } finally {
        if (previous === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = previous;
    }
});

test("CSRF protection rejects cookie-authenticated cross-site and originless mutations", () => {
    for (const req of [
        request({ headers: { origin: "https://evil.example" }, cookies: { token: "session" } }),
        request({ cookies: { refreshToken: "session" } })
    ]) {
        const res = response();
        csrfProtection(req, res, () => assert.fail("next must not be called"));
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.code, "CSRF_ORIGIN_INVALID");
    }
});

test("CSRF protection preserves bearer and server-to-server clients", () => {
    for (const req of [
        request({ headers: { authorization: "Bearer mobile-token" } }),
        request()
    ]) {
        let nextCalled = false;
        csrfProtection(req, response(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    }
});
