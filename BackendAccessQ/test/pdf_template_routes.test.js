const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mountRouter,
    request
} = require("./helpers/http");

const loadPdfTemplateApp = ({ user, service, prisma = {} }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/services/pdf_template.service", service);
    mockModule("src/prisma/client", {
        organization: {
            findUnique: async () => ({ name: "AccessQ" }),
            ...(prisma.organization || {})
        },
        ...prisma
    });

    const router = require("../src/routes/pdf_template.routes");
    return mountRouter("/pdf-templates", router);
};

test("GET /pdf-templates lists registered templates without exposing filenames", async () => {
    const app = loadPdfTemplateApp({
        user: { user_id: 1, org_id: 42, role: "ORG_ADMIN" },
        service: {
            listTemplates: () => [{
                id: "badge-horizontal",
                name: "Badge horizontal",
                fields: { modelName: { type: "text", required: true, label: "Nom du modèle" } }
            }]
        }
    });

    const res = await request(app, "GET", "/pdf-templates");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.templates[0].id, "badge-horizontal");
    assert.equal(res.body.templates[0].filename, undefined);
    assert.equal(res.body.templates[0].fields.company, undefined);
    assert.equal(res.body.templates[0].fields.identifier, undefined);
});

test("POST /pdf-templates/generate attaches organization context on the backend", async () => {
    let args = null;
    const app = loadPdfTemplateApp({
        user: { user_id: 1, org_id: 42, role: "ORG_ADMIN" },
        service: {
            generateDocument: async (payload) => {
                args = payload;
                return {
                    filename: "document_badge-horizontal_1_abcdefabcdef.pdf",
                    url: "/generated-documents/document_badge-horizontal_1_abcdefabcdef.pdf",
                    downloadUrl: "/generated-documents/document_badge-horizontal_1_abcdefabcdef.pdf/download"
                };
            }
        }
    });

    const res = await request(app, "POST", "/pdf-templates/generate", {
        templateId: "badge-horizontal",
        values: { modelName: "Badge VIP", company: "Ignored", identifier: "Ignored" }
    });

    assert.equal(res.status, 201);
    assert.deepEqual(args, {
        templateId: "badge-horizontal",
        values: { modelName: "Badge VIP", company: "Ignored", identifier: "Ignored" },
        context: {
            orgId: 42,
            organizationName: "AccessQ"
        }
    });
    assert.equal(res.body.document.filename, "document_badge-horizontal_1_abcdefabcdef.pdf");
});

test("POST /pdf-templates/generate requires an authenticated organization", async () => {
    const app = loadPdfTemplateApp({
        user: { user_id: 1, role: "ORG_ADMIN" },
        service: {
            generateDocument: async () => {
                throw new Error("should not be called");
            }
        }
    });

    const res = await request(app, "POST", "/pdf-templates/generate", {
        templateId: "badge-horizontal",
        values: { fullName: "Junior" }
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
});
