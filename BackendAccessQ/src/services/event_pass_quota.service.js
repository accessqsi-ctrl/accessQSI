const { getPlanSummary } = require("../config/subscription");
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");

const countActiveEventPasses = async (dbClient, organizationId, now = new Date()) => {
    if (!organizationId || typeof dbClient?.eventPass?.count !== "function") return 0;
    return dbClient.eventPass.count({
        where: {
            org_id: organizationId,
            OR: [
                { status: "AVAILABLE" },
                { status: "ASSIGNED", expires_at: { gt: now } }
            ]
        }
    });
};

const getPlanSummaryWithEventPasses = async (dbClient, organization, now = new Date()) => {
    const activePassCount = await countActiveEventPasses(dbClient, organization?.org_id, now);
    return getPlanSummary(organization, now, activePassCount);
};

const reconcileExpiredEventPassQuotas = async (dbClient = prisma, now = new Date()) => {
    if (typeof dbClient?.eventPass?.findMany !== "function") return 0;
    const expiredOrganizations = await dbClient.eventPass.findMany({
        where: { status: "ASSIGNED", expires_at: { lte: now } },
        select: { org_id: true },
        distinct: ["org_id"]
    });
    let reconciled = 0;

    for (const { org_id: organizationId } of expiredOrganizations) {
        await dbClient.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${organizationId} FOR UPDATE`);
            await tx.eventPass.updateMany({
                where: { org_id: organizationId, status: "ASSIGNED", expires_at: { lte: now } },
                data: { status: "EXPIRED" }
            });
            const organization = await tx.organization.findUnique({
                where: { org_id: organizationId },
                include: { plan: true }
            });
            if (!organization) return;
            const summary = await getPlanSummaryWithEventPasses(tx, organization, now);

            if (summary.limits.maxAgents != null) {
                const agents = await tx.userQ.findMany({
                    where: { org_id: organizationId, role: { in: ["ORG_AGENT", "OPERATOR"] }, deleted_at: null, is_active: true },
                    select: { user_id: true },
                    orderBy: [{ created_at: "asc" }, { user_id: "asc" }]
                });
                const excessAgentIds = agents.slice(summary.limits.maxAgents).map(({ user_id }) => user_id);
                if (excessAgentIds.length) {
                    await tx.userQ.updateMany({
                        where: { org_id: organizationId, user_id: { in: excessAgentIds } },
                        data: { is_active: false, suspended_by_plan: true }
                    });
                }
            }

            if (summary.limits.maxAreas != null) {
                const areas = await tx.area.findMany({
                    where: { org_id: organizationId, deleted_at: null, suspended_by_plan: false },
                    select: { area_id: true },
                    orderBy: { area_id: "asc" }
                });
                const excessAreaIds = areas.slice(summary.limits.maxAreas).map(({ area_id }) => area_id);
                if (excessAreaIds.length) {
                    await tx.area.updateMany({
                        where: { org_id: organizationId, area_id: { in: excessAreaIds } },
                        data: { suspended_by_plan: true }
                    });
                }
            }
            reconciled += 1;
        });
    }

    return reconciled;
};

module.exports = {
    countActiveEventPasses,
    getPlanSummaryWithEventPasses,
    reconcileExpiredEventPassQuotas
};
