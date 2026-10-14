const test = require("node:test");
const assert = require("node:assert/strict");
const { assertRegistrationConfigurationAllowed } = require("../src/services/registration_plan.service");

const discovery = { plan: "DISCOVERY", capabilities: [] };
const essential = { plan: "ESSENTIAL", capabilities: ["multiple_registration_offers"] };
const pro = { plan: "PRO", capabilities: ["multiple_registration_offers", "custom_card_templates"] };

test("Découverte autorise un formulaire simple à une offre standard", () => {
    assert.doesNotThrow(() => assertRegistrationConfigurationAllowed(discovery, [
        { card_template_id: "event-ticket" }
    ]));
});

test("Découverte refuse plusieurs offres", () => {
    assert.throws(
        () => assertRegistrationConfigurationAllowed(discovery, [
            { card_template_id: "event-ticket" },
            { card_template_id: "vip-pass" }
        ]),
        error => error.code === "PLAN_CAPABILITY_REQUIRED"
            && error.statusCode === 403
            && error.requiredCapability === "multiple_registration_offers"
    );
});

test("Essential autorise plusieurs offres mais refuse un modèle personnalisé", () => {
    assert.doesNotThrow(() => assertRegistrationConfigurationAllowed(essential, [
        { card_template_id: "event-ticket" },
        { card_template_id: "vip-pass" }
    ]));
    assert.throws(
        () => assertRegistrationConfigurationAllowed(essential, [{ card_template_id: "custom:7" }]),
        error => error.code === "PLAN_CAPABILITY_REQUIRED"
            && error.requiredCapability === "custom_card_templates"
    );
});

test("Pro autorise plusieurs offres et les modèles personnalisés", () => {
    assert.doesNotThrow(() => assertRegistrationConfigurationAllowed(pro, [
        { card_template_id: "custom:7" },
        { card_template_id: "event-ticket" }
    ]));
});
