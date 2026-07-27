const prisma = require("../prisma/client");

exports.findAll = async (orgId) => {
    return await prisma.area.findMany({
        where: { org_id: orgId, deleted_at: null },
        orderBy: { area_name: 'asc' }
    });
};

exports.findById = async (orgId, areaId) => {
    return await prisma.area.findFirst({
        where: { area_id: areaId, org_id: orgId, deleted_at: null }
    });
};

exports.createArea = async (data, dbClient = prisma) => {
    return await dbClient.area.create({ data });
};

exports.countActiveForOrg = async (orgId) => {
    return await prisma.area.count({
        where: { org_id: orgId, deleted_at: null }
    });
};

exports.updateArea = async (areaId, data) => {
    return await prisma.area.update({
        where: { area_id: areaId },
        data
    });
};

exports.deleteArea = async (areaId) => {
    return await prisma.area.update({
        where: { area_id: areaId },
        data: { deleted_at: new Date() }
    });
};
