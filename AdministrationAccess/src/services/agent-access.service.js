const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');

const AGENT_ROLES = Object.freeze(['ORG_AGENT', 'OPERATOR']);
const PLAN_AGENT_LIMITS = Object.freeze({ DISCOVERY: 2, FREE: 2, ESSENTIAL: 5, PRO: 15, ENTERPRISE: null });

const accessError = (code) => Object.assign(new Error(code), { code });

const getAgentLimit = (organization, now = new Date()) => {
    if (organization.subscription_expires_at && new Date(organization.subscription_expires_at) <= now) return PLAN_AGENT_LIMITS.DISCOVERY;
    const plan = String(organization.plan?.title || 'DISCOVERY').trim().toUpperCase();
    if (plan === 'ENTERPRISE') {
        const configured = organization.enterprise_entitlements?.maxAgents;
        if (configured === null) return null;
        if (Number.isInteger(Number(configured)) && Number(configured) >= 0) return Number(configured);
    }
    return Object.hasOwn(PLAN_AGENT_LIMITS, plan) ? PLAN_AGENT_LIMITS[plan] : PLAN_AGENT_LIMITS.DISCOVERY;
};

const runSerializable = async (operation) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            return await prisma.$transaction(operation, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable
            });
        } catch (error) {
            if (error.code !== 'P2034' || attempt === 3) throw error;
        }
    }
};

const setAgentActive = async ({ userId, active }) => runSerializable(async (tx) => {
    const agent = await tx.userQ.findUnique({
        where: { user_id: userId },
        select: { user_id: true, org_id: true, role: true, deleted_at: true, is_active: true, suspended_by_plan: true }
    });
    if (!agent || !AGENT_ROLES.includes(agent.role)) throw accessError('AGENT_NOT_FOUND');
    if (agent.deleted_at) throw accessError('AGENT_ARCHIVED');
    if (!agent.org_id) throw accessError('AGENT_WITHOUT_ORGANIZATION');

    await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${agent.org_id} FOR UPDATE`);
    const organization = await tx.organization.findUnique({
        where: { org_id: agent.org_id },
        include: { plan: true }
    });
    if (!organization || organization.deleted_at) throw accessError('ORGANIZATION_INACTIVE');

    if (active) {
        if (!organization.is_active) throw accessError('ORGANIZATION_INACTIVE');
        if (agent.suspended_by_plan) throw accessError('AGENT_SUSPENDED_BY_PLAN');
        if (!agent.is_active) {
            const limit = getAgentLimit(organization);
            const activeCount = await tx.userQ.count({
                where: { org_id: agent.org_id, role: { in: [...AGENT_ROLES] }, deleted_at: null, is_active: true }
            });
            if (limit !== null && activeCount >= limit) {
                const error = accessError('PLAN_QUOTA_EXCEEDED');
                error.limit = limit;
                error.currentCount = activeCount;
                throw error;
            }
        }
    }

    const updated = await tx.userQ.update({
        where: { user_id: userId },
        data: { is_active: active }
    });
    return { agent: updated, organizationId: agent.org_id };
});

module.exports = { AGENT_ROLES, getAgentLimit, setAgentActive };
