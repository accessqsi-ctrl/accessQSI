const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateAccess, ACCESS_DENIAL } = require("../src/services/account_access.service");

const activeUser = {
    user_id: 7,
    role: "ORG_ADMIN",
    org_id: 42,
    session_version: 3,
    is_active: true,
    deleted_at: null,
    organization: { org_id: 42, is_active: true, deleted_at: null }
};

test("token state requires the current persisted session version", () => {
    assert.deepEqual(evaluateAccess(activeUser, {
        user_id: 7,
        role: "ORG_ADMIN",
        org_id: 42,
        session_version: 3
    }), { allowed: true, code: null });

    assert.deepEqual(evaluateAccess(activeUser, {
        user_id: 7,
        role: "ORG_ADMIN",
        org_id: 42,
        session_version: 2
    }), { allowed: false, code: ACCESS_DENIAL.TOKEN_STATE_STALE });
});
