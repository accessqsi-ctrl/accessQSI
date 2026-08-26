const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

const prisma = new PrismaClient();

const DEFAULT_EMAIL = 'admin@tinkli.com';
const DEFAULT_PASSWORD = 'Tinkli.Soft243*';

async function seedDefaultAdmin() {
    const email = String(process.env.DEFAULT_ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
    const password = String(process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_PASSWORD);
    const existingAdmin = await prisma.userQ.findUnique({ where: { email } });

    if (existingAdmin) {
        console.log(`Compte administrateur déjà présent : ${email}`);
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.userQ.create({
        data: {
            clef: crypto.randomUUID(),
            full_name: 'Administrateur Tinkli',
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
