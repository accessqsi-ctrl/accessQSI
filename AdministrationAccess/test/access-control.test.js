const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const mockPrisma = (prisma) => {
    const prismaPath = require.resolve(path.join(process.cwd(), 'src/lib/prisma.js'));
    const servicePath = require.resolve(path.join(process.cwd(), 'src/services/agent-access.service.js'));
    delete require.cache[servicePath];
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
    return require(servicePath);
};

const makeDatabase = ({ agent = {}, organization = {}, activeCount = 0 } = {}) => {
    const updates = [];
    const tx = {
        $queryRaw: async () => [],
        userQ: {
            findUnique: async () => ({
                user_id: 12, org_id: 42, role: 'ORG_AGENT', deleted_at: null,
                is_active: false, suspended_by_plan: false, ...agent
            }),
            count: async () => activeCount,
            update: async ({ data }) => { updates.push(data); return { user_id: 12, ...data }; }
        },
        organization: {
            findUnique: async () => ({
                org_id: 42, is_active: true, deleted_at: null,
                subscription_expires_at: null, enterprise_entitlements: null,
                plan: { title: 'DISCOVERY' }, ...organization
            })
        }
    };
    return {
        prisma: { $transaction: async (operation) => operation(tx) },
        updates
    };
};

test('agent deactivation is reversible and does not mark personal data as deleted', async () => {
    const db = makeDatabase({ agent: { is_active: true } });
    const { setAgentActive } = mockPrisma(db.prisma);
    await setAgentActive({ userId: 12, active: false });
    assert.deepEqual(db.updates, [{ is_active: false }]);
});

test('agent activation is denied when its organization is inactive', async () => {
    const db = makeDatabase({ organization: { is_active: false } });
    const { setAgentActive } = mockPrisma(db.prisma);
    await assert.rejects(() => setAgentActive({ userId: 12, active: true }), { code: 'ORGANIZATION_INACTIVE' });
    assert.equal(db.updates.length, 0);
});

test('agent activation enforces the active-agent plan quota', async () => {
    const db = makeDatabase({ activeCount: 2 });
    const { setAgentActive } = mockPrisma(db.prisma);
    await assert.rejects(() => setAgentActive({ userId: 12, active: true }), { code: 'PLAN_QUOTA_EXCEEDED' });
    assert.equal(db.updates.length, 0);
});

test('agent activation cannot target an organization administrator', async () => {
    const db = makeDatabase({ agent: { role: 'ORG_ADMIN' } });
    const { setAgentActive } = mockPrisma(db.prisma);
    await assert.rejects(() => setAgentActive({ userId: 12, active: true }), { code: 'AGENT_NOT_FOUND' });
});

test('CSRF middleware accepts the signed session token and rejects mismatches', () => {
    const { requireCsrf } = require('../src/controllers/auth.controller');
    let allowed = false;
    requireCsrf({ method: 'POST', user: { csrf: 'known-token' }, body: { _csrf: 'known-token' } }, {}, () => { allowed = true; });
    assert.equal(allowed, true);

    const response = { statusCode: null, status(code) { this.statusCode = code; return this; }, send() { return this; } };
    requireCsrf({ method: 'POST', user: { csrf: 'known-token' }, body: { _csrf: 'wrong-token' } }, response, () => {});
    assert.equal(response.statusCode, 403);
});
