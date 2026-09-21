const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcrypt');

const loadController = (prisma) => {
    const prismaPath = require.resolve(path.join(process.cwd(), 'src/lib/prisma.js'));
    const auditPath = require.resolve(path.join(process.cwd(), 'src/services/audit.service.js'));
    const controllerPath = require.resolve(path.join(process.cwd(), 'src/controllers/organization.controller.js'));
    delete require.cache[controllerPath];
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
    require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { writeAudit: () => {} } };
    return require(controllerPath);
};

const response = () => ({
    destination: null,
    renderedView: null,
    renderedData: null,
    redirect(destination) { this.destination = destination; return this; },
    render(view, data) { this.renderedView = view; this.renderedData = data; return this; }
});

test('organization detail groups only the required account data', async () => {
    let organizationQuery;
    const controller = loadController({
        organization: {
            findFirst: async (query) => {
                organizationQuery = query;
                return {
                    org_id: 42,
                    name: 'Exemple',
                    usersQ: [
                        { user_id: 1, role: 'ORG_ADMIN' },
                        { user_id: 2, role: 'ORG_AGENT' },
                        { user_id: 3, role: 'OPERATOR' }
                    ],
                    _count: { usersQ: 3, events: 1, areas: 1, payments: 0 }
                };
            }
        },
        qrCode: { count: async () => 7 }
    });
    const res = response();

    await controller.showOrganization({ params: { id: '42' }, query: {}, user: { id: 1 } }, res);

    assert.equal(res.renderedView, 'organizations/detail');
    assert.deepEqual(res.renderedData.administrators.map(({ user_id }) => user_id), [1]);
    assert.deepEqual(res.renderedData.agents.map(({ user_id }) => user_id), [2, 3]);
    assert.equal(res.renderedData.qrCodeCount, 7);
    assert.equal(organizationQuery.where.deleted_at, null);
    assert.equal(organizationQuery.include.usersQ.select.password_hash, undefined);
    assert.equal(organizationQuery.include.usersQ.select.verification_token, undefined);
    assert.equal(organizationQuery.include.usersQ.select.clef, undefined);
});

test('organization suspension changes only the organization gate', async () => {
    const updates = [];
    const controller = loadController({
        organization: { updateMany: async (args) => { updates.push(args); return { count: 1 }; } }
    });
    const res = response();
    await controller.deactivateOrganization({ params: { id: '42' }, user: { id: 1 } }, res);
    assert.deepEqual(updates, [{ where: { org_id: 42, deleted_at: null }, data: { is_active: false } }]);
    assert.match(res.destination, /success=/);
});

test('an archived organization cannot be reactivated', async () => {
    const controller = loadController({
        organization: { updateMany: async () => ({ count: 0 }) }
    });
    const res = response();
    await controller.activateOrganization({ params: { id: '42' }, user: { id: 1 } }, res);
    assert.match(res.destination, /error=/);
});

test('subscription change requires the current super-admin password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    let transactions = 0;
    const controller = loadController({
        userQ: { findFirst: async () => ({ password_hash: passwordHash }) },
        $transaction: async () => { transactions += 1; }
    });
    const res = response();

    await controller.changeSubscription({
        params: { id: '42' },
        body: { targetPlan: 'PRO', billingInterval: 'MONTHLY', superAdminPassword: 'wrong-password' },
        user: { id: 1 }
    }, res);

    assert.equal(transactions, 0);
    assert.match(res.destination, /Mot%20de%20passe%20incorrect/);
});

test('confirmed subscription change updates both subscription records and audit history', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const calls = {};
    const tx = {
        $queryRaw: async () => [],
        organization: {
            findFirst: async () => ({
                org_id: 42,
                plan: { title: 'ESSENTIAL' },
                subscription_interval: 'MONTHLY',
                subscription_started_at: new Date('2026-01-01T00:00:00Z'),
                subscription_expires_at: new Date('2026-01-31T00:00:00Z'),
                subscription: { status: 'ACTIVE' }
            }),
            update: async ({ data }) => { calls.organization = data; return data; }
        },
        plan: { findUnique: async () => ({ plan_id: 3, title: 'PRO' }) },
        userQ: {
            findMany: async () => [],
            updateMany: async () => ({ count: 0 })
        },
        area: {
            findMany: async () => [],
            updateMany: async () => ({ count: 0 })
        },
        subscription: { upsert: async ({ update }) => { calls.subscription = update; return update; } },
        subscriptionPeriod: { create: async ({ data }) => { calls.period = data; return data; } },
        subscriptionAuditLog: { create: async ({ data }) => { calls.audit = data; return data; } }
    };
    let transactionOptions;
    const controller = loadController({
        userQ: { findFirst: async () => ({ password_hash: passwordHash }) },
        $transaction: async (operation, options) => {
            transactionOptions = options;
            return operation(tx);
        }
    });
    const res = response();

    await controller.changeSubscription({
        params: { id: '42' },
        body: { targetPlan: 'PRO', billingInterval: 'ANNUAL', superAdminPassword: 'correct-password' },
        user: { id: 7 }
    }, res);

    assert.equal(calls.organization.subscription_plan, 3);
    assert.equal(calls.organization.subscription_interval, 'ANNUAL');
    assert.equal(calls.subscription.status, 'ACTIVE');
    assert.equal(calls.period.source, 'SUPER_ADMIN_OVERRIDE');
    assert.equal(calls.audit.actor_user_id, 7);
    assert.equal(calls.audit.action, 'SUPER_ADMIN_SUBSCRIPTION_CHANGED');
    assert.deepEqual(transactionOptions, { maxWait: 5000, timeout: 20000 });
    assert.match(res.destination, /success=/);
});
