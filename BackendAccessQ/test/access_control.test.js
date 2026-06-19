const test = require("node:test");
const assert = require("node:assert/strict");
const requireRole = require("../src/middleware/roleMiddleware");
const { canManageAgents } = require("../src/controllers/api.agent.controller");

const makeResponse = () => {
    const res = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
    return res;
};

test("canManageAgents allows organization admins and super admins linked to an organization", () => {
    assert.equal(canManageAgents({ role: "ORG_ADMIN", org_id: 1 }), true);
    assert.equal(canManageAgents({ role: "SUPER_ADMIN", org_id: 1 }), true);
});

test("canManageAgents rejects missing organization or non-admin roles", () => {
    assert.equal(canManageAgents({ role: "SUPER_ADMIN", org_id: null }), null);
    assert.equal(canManageAgents({ role: "ORG_AGENT", org_id: 1 }), false);
    assert.equal(canManageAgents(null), null);
});

test("requireRole calls next for allowed roles", () => {
    const req = { user: { role: "ORG_ADMIN" } };
    const res = makeResponse();
    let nextCalled = false;

    requireRole(["ORG_ADMIN", "SUPER_ADMIN"])(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
});

test("requireRole rejects missing or disallowed roles", () => {
    const resMissing = makeResponse();
    const resDisallowed = makeResponse();

    requireRole(["ORG_ADMIN"])({}, resMissing, () => {});
    requireRole(["ORG_ADMIN"])({ user: { role: "ORG_AGENT" } }, resDisallowed, () => {});

    assert.equal(resMissing.statusCode, 403);
    assert.equal(resMissing.body.success, false);
    assert.equal(resDisallowed.statusCode, 403);
    assert.equal(resDisallowed.body.success, false);
});
