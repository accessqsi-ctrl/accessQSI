// Copie le schéma Prisma du backend (source de vérité) dans la console d'administration.
// Usage : npm run prisma:sync  (ajoutez --check pour seulement vérifier l'écart)
const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '../../BackendAccessQ/src/prisma/schema.prisma');
const targetPath = path.resolve(__dirname, '../prisma/schema.prisma');
const checkOnly = process.argv.includes('--check');

if (!fs.existsSync(sourcePath)) {
    console.warn(`[prisma:sync] Schéma backend introuvable (${sourcePath}), synchronisation ignorée.`);
    process.exit(0);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const target = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';

if (source === target) {
    console.log('[prisma:sync] Schéma déjà synchronisé avec BackendAccessQ.');
    process.exit(0);
}

if (checkOnly) {
    console.error('[prisma:sync] prisma/schema.prisma diffère de BackendAccessQ/src/prisma/schema.prisma. Lancez npm run prisma:sync.');
    process.exit(1);
}

fs.writeFileSync(targetPath, source);
console.log('[prisma:sync] prisma/schema.prisma mis à jour depuis BackendAccessQ.');
