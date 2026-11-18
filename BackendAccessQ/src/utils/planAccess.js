const prisma = require("../prisma/client");
const { PLAN_KEYS } = require("../config/subscription");
const { getPlanSummaryWithEventPasses } = require("../services/event_pass_quota.service");

const getFreePlanContext = () => ({
    organization: null,
    plan: PLAN_KEYS.FREE,
    planName: "Découverte",
    isPro: false,
    isPaid: false,
    limits: {
        maxEvents: 1,
        maxEventsPerCycle: 1,
        maxQrCodes: 50,
        maxQrCodesPerEvent: 50,
        maxAgents: 1,
        maxAreas: 1,
        maxPdfPagesPerFile: 200
    },
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

        const summary = await getPlanSummaryWithEventPasses(prisma, organization);

        return {
            organization,
            plan: summary.plan,
            planName: summary.planName,
            isPro: summary.isPro,
            isPaid: summary.isPaid,
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
