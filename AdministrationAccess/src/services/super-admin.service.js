const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');

// Les actions sensibles redemandent le mot de passe du super-admin connecté.
const verifySuperAdminPassword = async (req) => {
    const password = typeof req.body.superAdminPassword === 'string' ? req.body.superAdminPassword : '';
    if (!password) return false;
    const administrator = await prisma.userQ.findFirst({
        where: {
            user_id: Number(req.user?.id),
            role: 'SUPER_ADMIN',
            is_active: true,
            deleted_at: null
        },
        select: { password_hash: true }
    });
    return Boolean(administrator && await bcrypt.compare(password, administrator.password_hash));
};

module.exports = { verifySuperAdminPassword };
