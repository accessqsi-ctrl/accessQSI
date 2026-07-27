const prisma = require("../prisma/client");
const { getPlanSummary, PLAN_KEYS } = require("../config/subscription");

const getFreePlanContext = () => ({
    organization: null,
    plan: PLAN_KEYS.FREE,
    planName: "Free",
    isPro: false,
    limits: { maxEvents: 3, maxQrCodes: 100, maxAgents: 4, maxAreas: 4 },
    capabilities: [],
    features: []
});

const getOrganizationPlanContext = async (organizationId) => {
    if (!organizationId) {
        return getFreePlanContext();
    }

    try {
        if (!prisma?.organization?.findUnique) {
            return getFreePlanContext();
        }

        const organization = await prisma.organization.findUnique({
            where: { org_id: organizationId },
            include: { plan: true }
        });

        const summary = getPlanSummary(organization);

        return {
            organization,
            plan: summary.plan,
            planName: summary.planName,
            isPro: summary.isPro,
            limits: summary.limits,
            capabilities: summary.capabilities,
            features: summary.features
        };
    } catch (error) {
        return getFreePlanContext();
    }
};

const getPlanContextForUser = async (req) => {
    const organizationId = req?.user?.org_id;
    return getOrganizationPlanContext(organizationId);
};

module.exports = {
    getOrganizationPlanContext,
    getPlanContextForUser
};
