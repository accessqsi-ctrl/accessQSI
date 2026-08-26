const { PrismaClient } = require('@prisma/client');

const prisma = global.__accessQAdminPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    global.__accessQAdminPrisma = prisma;
}

module.exports = prisma;
