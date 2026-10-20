const { PLAN_CAPABILITIES, hasPlanCapability } = require("../config/subscription");

class RegistrationPlanError extends Error {
    constructor(message, requiredCapability) {
        super(message);
        this.name = "RegistrationPlanError";
        this.code = "PLAN_CAPABILITY_REQUIRED";
        this.statusCode = 403;
        this.requiredCapability = requiredCapability;
    }
}

const isCustomTemplate = templateId => String(templateId || "").startsWith("custom:");

const assertRegistrationConfigurationAllowed = (planContext, offers = []) => {
    if (
        offers.length > 1
        && !hasPlanCapability(planContext, PLAN_CAPABILITIES.MULTIPLE_REGISTRATION_OFFERS)
    ) {
        throw new RegistrationPlanError(
            "Votre abonnement autorise une seule offre par formulaire. Passez à Essential ou Pro pour proposer plusieurs offres.",
            PLAN_CAPABILITIES.MULTIPLE_REGISTRATION_OFFERS
        );
    }

    if (
        offers.some(offer => isCustomTemplate(offer.card_template_id || offer.cardTemplateId))
        && !hasPlanCapability(planContext, PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES)
    ) {
        throw new RegistrationPlanError(
            "Les modèles personnalisés nécessitent un abonnement Pro.",
            PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES
        );
    }
};

module.exports = { RegistrationPlanError, assertRegistrationConfigurationAllowed, isCustomTemplate };
