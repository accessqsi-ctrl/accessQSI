const prisma = require("../prisma/client");

exports.getAllAgentsForOrg = async (orgId) => {
    return await prisma.userQ.findMany({
        where: {
            org_id: orgId,
            role: { in: ["ORG_AGENT", "ORG_ADMIN", "OPERATOR"] }
        },
        include: {
            _count: {
                select: {
                    scan_logs: {
                        where: {
                            qr_code: {
                                event: { org_id: orgId }
                            }
                        }
                    }
                }
            }
        },
        orderBy: {
            created_at: 'desc'
        }
    });
};

exports.createAgent = async (orgId, fullName, email, hashedPassword, role = "ORG_AGENT", dbClient = prisma) => {
    return await dbClient.userQ.create({
        data: {
            org_id: orgId,
            full_name: fullName,
            email: email,
            password_hash: hashedPassword,
            role: role,
            is_verified: true, // Vérifié automatiquement car c'est une invitation interne
            clef: require("crypto").randomUUID()
        }
    });
};

exports.countActiveAgentsForOrg = async (orgId) => {
    return await prisma.userQ.count({
        where: {
            org_id: orgId,
            role: { in: ["ORG_AGENT", "OPERATOR"] },
            deleted_at: null,
            is_active: true
        }
    });
};

exports.getAgentByIdAndOrg = async (userId, orgId) => {
    return await prisma.userQ.findFirst({
        where: {
            user_id: userId,
            org_id: orgId
        }
    });
};

exports.updateAgentStatus = async (userId, isDeleted, dbClient = prisma) => {
    return await dbClient.userQ.update({
        where: { user_id: userId },
        data: {
            deleted_at: isDeleted ? new Date() : null
        }
    });
};

exports.softDeleteAgent = async (userId, orgId) => {
    return await prisma.userQ.update({
        where: { user_id: userId },
        data: { deleted_at: new Date() }
    });
};
