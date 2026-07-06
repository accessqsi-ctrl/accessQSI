const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const loadCardTemplateApp = ({ user, service }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/custom_card_template.service", service);

    const router = require("../src/routes/card_template.routes");
    return mountRouter("/card-templates", router);
};

test("GET /card-templates/custom lists custom templates for the organization", async () => {
    let orgLookup = null;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_AGENT", org_id: 42 },
        service: {
            listForOrg: async (orgId) => {
                orgLookup = orgId;
                return {
                    defaultTemplateId: "custom:5",
                    templates: [{ id: 5, templateId: "custom:5", name: "VIP Bleu" }]
                };
            }
        }
    });

    const res = await request(app, "GET", "/card-templates/custom");

    assert.equal(res.status, 200);
    assert.equal(orgLookup, 42);
    assert.equal(res.body.success, true);
    assert.equal(res.body.defaultTemplateId, "custom:5");
    assert.equal(res.body.templates[0].templateId, "custom:5");
});

test("POST /card-templates/custom creates a custom template for admins", async () => {
    let payload = null;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_ADMIN", org_id: 42 },
        service: {
            createForOrg: async (orgId, body) => {
                payload = { orgId, body };
                return { id: 6, templateId: "custom:6", name: body.name };
            }
        }
    });

    const res = await request(app, "POST", "/card-templates/custom", {
        baseTemplateId: "event-ticket",
        name: "Ticket corporate",
        primaryColor: "#2563eb",
        secondaryColor: "#dbeafe",
        title: "INVITATION",
        qrPosition: "right",
        visibleFields: { holder: true },
        layoutConfig: {
            version: 2,
            backgroundOpacity: 0.6,
            elements: [
                { type: "event", x: 100, y: 120, width: 500, height: 80, fontSize: 42, fontWeight: "900", color: "#2563eb", align: "left", visible: true, locked: true, opacity: 0.8, zIndex: 4 }
            ]
        }
    });

    assert.equal(res.status, 201);
    assert.equal(payload.orgId, 42);
    assert.equal(payload.body.name, "Ticket corporate");
    assert.equal(payload.body.layoutConfig.elements[0].locked, true);
    assert.equal(payload.body.layoutConfig.elements[0].opacity, 0.8);
    assert.equal(payload.body.layoutConfig.elements[0].zIndex, 4);
    assert.equal(res.body.template.templateId, "custom:6");
});

test("POST /card-templates/custom rejects non-admin users", async () => {
    let created = false;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_AGENT", org_id: 42 },
        service: {
            createForOrg: async () => {
                created = true;
            }
        }
    });

    const res = await request(app, "POST", "/card-templates/custom", { name: "Nope" });

    assert.equal(res.status, 403);
    assert.equal(created, false);
});

test("PUT /card-templates/custom/:id/default sets a custom template as default", async () => {
    let args = null;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_ADMIN", org_id: 42 },
        service: {
            setDefaultForOrg: async (orgId, id) => {
                args = { orgId, id };
                return { defaultTemplateId: id };
            }
        }
    });

    const res = await request(app, "PUT", "/card-templates/custom/9/default");

    assert.equal(res.status, 200);
    assert.deepEqual(args, { orgId: 42, id: "custom:9" });
    assert.equal(res.body.defaultTemplateId, "custom:9");
});

test("PUT /card-templates/default can set a standard template as default", async () => {
    let args = null;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_ADMIN", org_id: 42 },
        service: {
            setDefaultForOrg: async (orgId, templateId) => {
                args = { orgId, templateId };
                return { defaultTemplateId: templateId };
            }
        }
    });

    const res = await request(app, "PUT", "/card-templates/default", {
        templateId: "event-ticket"
    });

    assert.equal(res.status, 200);
    assert.deepEqual(args, { orgId: 42, templateId: "event-ticket" });
    assert.equal(res.body.defaultTemplateId, "event-ticket");
});

test("POST /card-templates/custom/:id/duplicate duplicates a custom template", async () => {
    let args = null;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_ADMIN", org_id: 42 },
        service: {
            duplicateForOrg: async (orgId, id) => {
                args = { orgId, id };
                return { id: 12, templateId: "custom:12", name: "Copie" };
            }
        }
    });

    const res = await request(app, "POST", "/card-templates/custom/9/duplicate");

    assert.equal(res.status, 201);
    assert.deepEqual(args, { orgId: 42, id: "9" });
    assert.equal(res.body.template.templateId, "custom:12");
});
