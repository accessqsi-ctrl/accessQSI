const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const { getPlanSummary, getQuotaStatus } = require("../config/subscription");

class PlanQuotaError extends Error {
    constructor({ resourceName, currentCount, limit, planSummary }) {
        super(`Quota ${resourceName} atteint (${currentCount}/${limit}).`);
        this.name = "PlanQuotaError";
        this.code = "PLAN_QUOTA_EXCEEDED";
        this.resourceName = resourceName;
        this.currentCount = currentCount;
        this.limit = limit;
        this.plan = planSummary.plan;
        this.planName = planSummary.planName;
    }
}

const withOrganizationQuota = async ({
    organizationId,
    limitKey,
    resourceName,
    count,
    create
}) => {
    const runTransaction = () => prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
            Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${organizationId} FOR UPDATE`
        );

        const organization = await tx.organization.findUnique({
            where: { org_id: organizationId },
            include: { plan: true }
        });
        const planSummary = getPlanSummary(organization);
        const currentCount = await count(tx);
        const quotaStatus = getQuotaStatus(planSummary.limits[limitKey], currentCount);

        if (!quotaStatus.allowed) {
            throw new PlanQuotaError({
                resourceName,
                currentCount,
                limit: quotaStatus.limit,
                planSummary
            });
        }

        return create(tx, planSummary);
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            return await runTransaction();
        } catch (error) {
            if (error?.code !== "P2034" || attempt === 3) throw error;
        }
    }

    throw new Error("Transaction de quota impossible.");
};

module.exports = {
    PlanQuotaError,
    withOrganizationQuota
};
