const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

const prisma = new PrismaClient();

const requiredEnvironmentValue = (name) => {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`${name} doit être défini explicitement.`);
    return value;
};

async function seedDefaultAdmin() {
    const email = requiredEnvironmentValue('DEFAULT_ADMIN_EMAIL').toLowerCase();
    const password = requiredEnvironmentValue('DEFAULT_ADMIN_PASSWORD');
    if (password.length < 12) {
        throw new Error('DEFAULT_ADMIN_PASSWORD doit contenir au moins 12 caractères.');
    }
    const existingAdmin = await prisma.userQ.findUnique({ where: { email } });

    if (existingAdmin) {
        console.log(`Compte administrateur déjà présent : ${email}`);
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.userQ.create({
        data: {
            clef: crypto.randomUUID(),
            full_name: 'Administrateur AccessQ',
            email,
            password_hash: passwordHash,
            role: 'SUPER_ADMIN',
            is_verified: true,
            is_active: true
        }
    });

    console.log(`Compte administrateur créé : ${email}`);
}

seedDefaultAdmin()
    .catch((error) => {
        console.error('Impossible de créer le compte administrateur par défaut :', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
