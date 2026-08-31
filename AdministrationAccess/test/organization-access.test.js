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
    redirect(destination) { this.destination = destination; return this; }
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
