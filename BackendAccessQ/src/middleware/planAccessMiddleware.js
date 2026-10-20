const { getPlanContextForUser } = require("../utils/planAccess");
const { hasPlanCapability } = require("../config/subscription");

const requirePlanAccess = (predicate, options = {}) => {
    const message = options.message || "Cette fonctionnalité nécessite un abonnement Pro.";
    const requiredCapability = options.requiredCapability;

    return async (req, res, next) => {
        try {
            const planContext = await getPlanContextForUser(req);

            if (predicate(planContext)) {
                req.planContext = planContext;
                return next();
            }

            res.locals ||= {};
            res.locals.logContext = {
                error_code: "PLAN_CAPABILITY_REQUIRED",
                reason: message,
                plan: planContext.plan,
                plan_name: planContext.planName,
                required_capability: requiredCapability,
                upgrade_required: true
            };

            return res.status(403).json({
                success: false,
                code: "PLAN_CAPABILITY_REQUIRED",
                message,
                plan: planContext.plan,
                planName: planContext.planName,
                requiredCapability,
                upgradeRequired: true
            });
        } catch (error) {
            res.locals ||= {};
            res.locals.logContext = {
                error_code: "PLAN_ACCESS_CHECK_FAILED",
                reason: "Impossible de vérifier l’abonnement.",
                required_capability: requiredCapability,
                error
            };
            return res.status(500).json({
                success: false,
                code: "PLAN_ACCESS_CHECK_FAILED",
                message: "Impossible de vérifier votre abonnement." 
            });
        }
    };
};

const requirePlanCapability = (capability, options = {}) => {
    return requirePlanAccess(
        (planContext) => hasPlanCapability(planContext, capability),
        { ...options, requiredCapability: capability }
    );
};

const requireProPlan = (options = {}) => {
    return requirePlanAccess((planContext) => planContext.isPro, options);
};

module.exports = requireProPlan;
module.exports.requirePlanCapability = requirePlanCapability;
