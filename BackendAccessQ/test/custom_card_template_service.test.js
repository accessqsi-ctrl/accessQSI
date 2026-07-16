const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");

test("updateForOrg modifies a published template directly", async () => {
    clearSrcModules();

    const existing = {
        id: 9,
        org_id: 42,
        base_template_id: "event-ticket",
        name: "Modèle publié",
        primary_color: "#2563eb",
        secondary_color: "#dbeafe",
        title: "INVITATION",
        card_message_default: "Présentez ce QR à l’entrée",
        logo_url: null,
        background_image_url: null,
        qr_position: "right",
        visible_fields: { holder: true, event: true, date: true, location: true, level: true, message: true, qr: true },
        layout_config: null,
        canvas_scene: null,
        layout: "wide",
        is_default: true,
        status: "PUBLISHED",
        deleted_at: null,
        created_at: new Date("2026-07-01T00:00:00.000Z"),
        updated_at: new Date("2026-07-01T00:00:00.000Z")
    };
    let updateArgs = null;

    mockModule("src/prisma/client", {
        cardTemplateCustom: {
            findFirst: async () => existing,
            update: async (args) => {
                updateArgs = args;
                return { ...existing, ...args.data, updated_at: new Date("2026-07-16T00:00:00.000Z") };
            }
        }
    });
    mockModule("src/services/card_template.service", {
        getTemplate: () => ({
            id: "event-ticket",
            label: "INVITATION",
            accent: "#2563eb",
            soft: "#dbeafe",
            layout: "wide",
            width: 1200,
            height: 800
        }),
        isTemplateAvailable: () => true
    });

    const service = require("../src/services/custom_card_template.service");
    const updated = await service.updateForOrg(42, 9, { name: "Modèle publié modifié" });

    assert.equal(updateArgs.where.id, 9);
    assert.equal(updateArgs.data.name, "Modèle publié modifié");
    assert.equal(Object.hasOwn(updateArgs.data, "status"), false);
    assert.equal(updated.name, "Modèle publié modifié");
    assert.equal(updated.status, "PUBLISHED");
});

test("setStatusForOrg republishes an archived template", async () => {
    clearSrcModules();

    const existing = {
        id: 10,
        org_id: 42,
        status: "ARCHIVED",
        deleted_at: null
    };
    let updateArgs = null;

    mockModule("src/prisma/client", {
        cardTemplateCustom: {
            findFirst: async () => existing,
            update: async (args) => {
                updateArgs = args;
                return {
                    ...existing,
                    ...args.data,
                    base_template_id: "event-ticket",
                    name: "Ancien modèle",
                    primary_color: "#2563eb",
                    secondary_color: "#dbeafe",
                    title: "INVITATION",
                    card_message_default: null,
                    logo_url: null,
                    background_image_url: null,
                    qr_position: "right",
                    visible_fields: {},
                    layout_config: null,
                    canvas_scene: null,
                    layout: "wide",
                    is_default: false,
                    created_at: new Date("2026-07-01T00:00:00.000Z"),
                    updated_at: new Date("2026-07-16T00:00:00.000Z")
                };
            }
        }
    });
    mockModule("src/services/card_template.service", {});

    const service = require("../src/services/custom_card_template.service");
    const republished = await service.setStatusForOrg(42, 10, "PUBLISHED");

    assert.deepEqual(updateArgs, {
        where: { id: 10 },
        data: { status: "PUBLISHED" }
    });
    assert.equal(republished.status, "PUBLISHED");
});
