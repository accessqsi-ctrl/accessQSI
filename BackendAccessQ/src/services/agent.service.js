const prisma = require("../prisma/client");

exports.getAllAgentsForOrg = async (orgId) => {
    return await prisma.userQ.findMany({
        where: {
            org_id: orgId,
            role: { in: ["ORG_AGENT", "ORG_ADMIN", "OPERATOR"] }
        },
        include: {
            _count: {
                select: { scan_logs: true }
            }
        },
        orderBy: {
            created_at: 'desc'
        }
    });
};

exports.createAgent = async (orgId, fullName, email, hashedPassword, role = "ORG_AGENT") => {
    return await prisma.userQ.create({
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

exports.getAgentByIdAndOrg = async (userId, orgId) => {
    return await prisma.userQ.findFirst({
        where: {
            user_id: userId,
            org_id: orgId
        }
    });
};

exports.updateAgentStatus = async (userId, isDeleted) => {
    return await prisma.userQ.update({
        where: { user_id: userId },
        data: {
            deleted_at: isDeleted ? new Date() : null
        }
    });
};

exports.hardDeleteAgent = async (userId, orgId) => {
    return await prisma.userQ.delete({
        where: { 
            user_id: userId,
            org_id: orgId
        }
    });
};
