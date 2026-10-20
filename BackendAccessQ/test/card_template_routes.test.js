const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const loadCardTemplateApp = ({ user, service, planContext = { isPro: true, plan: "PRO", planName: "Pro", limits: {}, features: [] } }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/custom_card_template.service", service);
    mockModule("src/utils/planAccess", {
        getPlanContextForUser: async () => planContext
    });

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

test("GET /card-templates/custom rejects Free organizations", async () => {
    let listCalled = false;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_ADMIN", org_id: 42 },
        planContext: {
            isPro: false,
            plan: "FREE",
            planName: "Free",
            limits: {},
            capabilities: []
        },
        service: {
            listForOrg: async () => {
                listCalled = true;
                return { defaultTemplateId: "", templates: [] };
            }
        }
    });

    const res = await request(app, "GET", "/card-templates/custom");

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "PLAN_CAPABILITY_REQUIRED");
    assert.equal(res.body.requiredCapability, "custom_card_templates");
    assert.equal(res.body.upgradeRequired, true);
    assert.equal(listCalled, false);
});

test("POST /card-templates/custom lets a Pro organization agent create a custom template", async () => {
    let payload = null;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_AGENT", org_id: 42 },
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
        },
        canvasScene: {
            version: 3,
            canvas: { width: 1600, height: 600, backgroundColor: "#ffffff" },
            objects: [
                { id: "event", type: "text", label: "Événement", field: "event", text: "{{event}}", x: 120, y: 100, width: 600, height: 70, fontSize: 48, fill: "#0f172a", visible: true, locked: false, zIndex: 2 },
                { id: "qr", type: "qr", label: "QR", x: 1250, y: 120, width: 240, height: 240, visible: true, locked: false, zIndex: 4 }
            ]
        }
    });

    assert.equal(res.status, 201);
    assert.equal(payload.orgId, 42);
    assert.equal(payload.body.name, "Ticket corporate");
    assert.equal(payload.body.layoutConfig.elements[0].locked, true);
    assert.equal(payload.body.layoutConfig.elements[0].opacity, 0.8);
    assert.equal(payload.body.layoutConfig.elements[0].zIndex, 4);
    assert.equal(payload.body.canvasScene.canvas.width, 1600);
    assert.equal(payload.body.canvasScene.objects[0].type, "text");
    assert.equal(res.body.template.templateId, "custom:6");
});

test("POST /card-templates/custom rejects operators", async () => {
    let created = false;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "OPERATOR", org_id: 42 },
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

test("POST /card-templates/custom rejects a Free organization agent", async () => {
    let created = false;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_AGENT", org_id: 42 },
        planContext: {
            isPro: false,
            plan: "FREE",
            planName: "Free",
            limits: {},
            capabilities: []
        },
        service: {
            createForOrg: async () => {
                created = true;
            }
        }
    });

    const res = await request(app, "POST", "/card-templates/custom", { name: "Modèle Free" });

    assert.equal(res.status, 403);
    assert.equal(res.body.upgradeRequired, true);
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

test("PUT /card-templates/default rejects a custom template on the Free plan", async () => {
    let setDefaultCalled = false;
    const app = loadCardTemplateApp({
        user: { user_id: 1, role: "ORG_ADMIN", org_id: 42 },
        planContext: {
            isPro: false,
            plan: "FREE",
            planName: "Free",
            limits: {},
            capabilities: []
        },
        service: {
            setDefaultForOrg: async () => {
                setDefaultCalled = true;
            }
        }
    });

    const res = await request(app, "PUT", "/card-templates/default", {
        templateId: "custom:9"
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.upgradeRequired, true);
    assert.equal(setDefaultCalled, false);
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

test("PUT /card-templates/custom/:id/default and default/clear are reserved to administrators", async () => {
    let called = false;
    const app = loadCardTemplateApp({
        user: { user_id: 2, role: "ORG_AGENT", org_id: 42 },
        service: {
            setDefaultForOrg: async () => { called = true; },
            clearDefaultForOrg: async () => { called = true; }
        }
    });

    const setDefault = await request(app, "PUT", "/card-templates/custom/9/default");
    const clearDefault = await request(app, "PUT", "/card-templates/custom/default/clear");

    assert.equal(setDefault.status, 403);
    assert.equal(clearDefault.status, 403);
    assert.equal(called, false);
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

const loadUploadController = () => {
    clearSrcModules();
    const saved = [];
    mockModule("src/services/custom_card_template.service", {});
    mockModule("src/services/storage.service", {
        saveUploadedAsset: async (asset) => {
            saved.push(asset);
            return `/${asset.directory}/${asset.filename}`;
        }
    });
    return { controller: require("../src/controllers/api.card_template.controller"), saved };
};

const invokeUpload = async (handler, file) => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    await handler({ file, user: { user_id: 1, org_id: 42 } }, res);
    return res;
};

test("template image uploads reject HTML, JS or SVG files whatever their declared type", async () => {
    const { controller, saved } = loadUploadController();
    for (const [name, content] of [
        ["logo.png", "<html><script>alert(1)</script></html>"],
        ["logo.js", "fetch('/api/user/profile')"],
        ["logo.svg", "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"]
    ]) {
        const res = await invokeUpload(controller.uploadLogo, {
            originalname: name,
            mimetype: "image/png",
            buffer: Buffer.from(content)
        });
        assert.equal(res.statusCode, 415, name);
    }
    assert.deepEqual(saved, []);
});

test("template image uploads store real images with an extension derived from their content", async () => {
    const { controller, saved } = loadUploadController();
    const res = await invokeUpload(controller.uploadBackground, {
        originalname: "fond.html",
        mimetype: "text/html",
        buffer: PNG
    });

    assert.equal(res.statusCode, 201);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].directory, "card-backgrounds");
    assert.equal(saved[0].contentType, "image/png");
    assert.match(saved[0].filename, /^background_42_[0-9a-f-]{36}\.png$/);
    assert.equal(saved[0].sourcePath, undefined);
    assert.match(res.body.backgroundImageUrl, /\.png$/);
});

