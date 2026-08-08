const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const {
    EVENT_PASS_DURATION_DAYS,
    getPlanSummary,
    getQuotaStatus
} = require("../config/subscription");

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

const runSerializable = async (operation) => {
    const run = () => prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            return await run();
        } catch (error) {
            if (error?.code !== "P2034" || attempt === 3) throw error;
        }
    }
    throw new Error("Transaction de quota impossible.");
};

const lockOrganizationWithPlan = async (tx, organizationId) => {
    await tx.$queryRaw(
        Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${organizationId} FOR UPDATE`
    );
    return tx.organization.findUnique({
        where: { org_id: organizationId },
        include: { plan: true }
    });
};

const withEventCreationQuota = async ({ organizationId, eventPassId = null, create }) => {
    return runSerializable(async (tx) => {
        const organization = await lockOrganizationWithPlan(tx, organizationId);
        const now = new Date();

        if (eventPassId) {
            const eventPass = await tx.eventPass.findFirst({
                where: {
                    event_pass_id: Number(eventPassId),
                    org_id: organizationId,
                    status: "AVAILABLE",
                    event_id: null
                }
            });
            if (!eventPass) {
                const error = new Error("Ce Pass événement est introuvable, expiré ou déjà utilisé.");
                error.code = "EVENT_PASS_NOT_AVAILABLE";
                throw error;
            }
            const expiresAt = new Date(now);
            expiresAt.setUTCDate(expiresAt.getUTCDate() + EVENT_PASS_DURATION_DAYS);
            const event = await create(tx, {
                entitlementType: "EVENT_PASS",
                qrLimit: 200,
                entitlementExpiresAt: expiresAt
            });
            await tx.eventPass.update({
                where: { event_pass_id: eventPass.event_pass_id },
                data: {
                    event_id: event.event_id,
                    status: "ASSIGNED",
                    activated_at: now,
                    expires_at: expiresAt
                }
            });
            return event;
        }

        const planSummary = getPlanSummary(organization, now);
        const currentCount = await tx.event.count({
            where: {
                org_id: organizationId,
                entitlement_type: "SUBSCRIPTION",
                created_at: {
                    gte: planSummary.cycleStartedAt,
                    lt: planSummary.cycleEndsAt
                }
            }
        });
        const quotaStatus = getQuotaStatus(planSummary.limits.maxEventsPerCycle, currentCount);
        if (!quotaStatus.allowed) {
            throw new PlanQuotaError({
                resourceName: "d'événements sur ce cycle mensuel",
                currentCount,
                limit: quotaStatus.limit,
                planSummary
            });
        }
        return create(tx, {
            entitlementType: "SUBSCRIPTION",
            qrLimit: planSummary.limits.maxQrCodesPerEvent ?? 2_147_483_647,
            entitlementExpiresAt: null
        });
    });
};

const withEventQrQuota = async ({ organizationId, eventId, create }) => {
    return runSerializable(async (tx) => {
        const organization = await lockOrganizationWithPlan(tx, organizationId);
        await tx.$queryRaw(Prisma.sql`SELECT event_id FROM events WHERE event_id = ${eventId} FOR UPDATE`);
        const event = await tx.event.findFirst({
            where: { event_id: eventId, org_id: organizationId, deleted_at: null }
        });
        if (!event) {
            const error = new Error("Événement introuvable.");
            error.code = "EVENT_NOT_FOUND";
            throw error;
        }

        const now = new Date();
        if (event.entitlement_type === "EVENT_PASS" && event.entitlement_expires_at <= now) {
            const error = new Error("Ce Pass événement a expiré. Les QR existants restent consultables, mais aucun nouveau QR ne peut être créé.");
            error.code = "EVENT_PASS_EXPIRED";
            throw error;
        }

        const planSummary = getPlanSummary(organization, now);
        const limit = event.entitlement_type === "EVENT_PASS"
            ? event.qr_limit
            : planSummary.limits.maxQrCodesPerEvent;
        const currentCount = await tx.qrCode.count({ where: { event_id: eventId } });
        const quotaStatus = getQuotaStatus(limit, currentCount);
        if (!quotaStatus.allowed) {
            throw new PlanQuotaError({
                resourceName: "de QR pour cet événement",
                currentCount,
                limit: quotaStatus.limit,
                planSummary
            });
        }
        return create(tx, { event, planSummary });
    });
};

module.exports = {
    PlanQuotaError,
    withOrganizationQuota,
    withEventCreationQuota,
    withEventQrQuota
};
