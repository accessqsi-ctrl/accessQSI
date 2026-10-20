const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const backendSchemaPath = path.resolve(__dirname, '../../BackendAccessQ/src/prisma/schema.prisma');
const adminSchemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

test('le schéma Prisma de l’administration est identique à celui du backend', { skip: !fs.existsSync(backendSchemaPath) }, () => {
    assert.equal(
        fs.readFileSync(adminSchemaPath, 'utf8'),
        fs.readFileSync(backendSchemaPath, 'utf8'),
        'Schéma désynchronisé : lancez npm run prisma:sync dans AdministrationAccess.'
    );
});
