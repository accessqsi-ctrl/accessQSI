const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

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
