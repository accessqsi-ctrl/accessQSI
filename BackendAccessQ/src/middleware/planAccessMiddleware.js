const { getPlanContextForUser } = require("../utils/planAccess");
const { hasPlanCapability } = require("../config/subscription");

const requirePlanAccess = (predicate, options = {}) => {
    const message = options.message || "Cette fonctionnalité nécessite un abonnement Pro.";

    return async (req, res, next) => {
        try {
            const planContext = await getPlanContextForUser(req);

            if (predicate(planContext)) {
                req.planContext = planContext;
                return next();
            }

            return res.status(403).json({
                success: false,
                message,
                plan: planContext.plan,
                planName: planContext.planName,
                upgradeRequired: true
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Impossible de vérifier votre abonnement." 
            });
        }
    };
};

const requirePlanCapability = (capability, options = {}) => {
    return requirePlanAccess(
        (planContext) => hasPlanCapability(planContext, capability),
        options
    );
};

const requireProPlan = (options = {}) => {
    return requirePlanAccess((planContext) => planContext.isPro, options);
};

module.exports = requireProPlan;
module.exports.requirePlanCapability = requirePlanCapability;
