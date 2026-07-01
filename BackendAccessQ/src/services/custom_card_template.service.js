const prisma = require("../prisma/client");
const cardTemplateService = require("./card_template.service");

const colorPattern = /^#[0-9a-fA-F]{6}$/;
const qrPositions = new Set(["right", "left", "center"]);
const visibleFieldKeys = ["holder", "event", "date", "location", "level", "message", "qr"];
const layoutElementTypes = new Set(["logo", "title", "event", "holder", "date", "location", "level", "message", "qr", "cardId"]);
const alignments = new Set(["left", "center", "right"]);

const boundedNumber = (value, fallback, min, max) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
};

const normalizeVisibleFields = (value = {}) => {
    const source = typeof value === "object" && value !== null ? value : {};
    return visibleFieldKeys.reduce((fields, key) => {
        fields[key] = source[key] !== false;
        return fields;
    }, {});
};

const normalizeLayoutConfig = (value = null) => {
    if (!value || typeof value !== "object") return null;
    const elements = Array.isArray(value.elements) ? value.elements : [];

    return {
        version: 2,
        elements: elements
            .filter(element => element && layoutElementTypes.has(element.type))
            .slice(0, 16)
            .map((element) => ({
                type: element.type,
                label: String(element.label || element.type).slice(0, 40),
                x: boundedNumber(element.x, 80, 0, 2000),
                y: boundedNumber(element.y, 80, 0, 2200),
                width: boundedNumber(element.width, 260, 20, 2000),
                height: boundedNumber(element.height, element.type === "qr" ? 260 : 60, 20, 2000),
                fontSize: boundedNumber(element.fontSize, 28, 8, 160),
                fontWeight: String(element.fontWeight || "700").slice(0, 12),
                color: colorPattern.test(String(element.color || "")) ? element.color : "#0f172a",
                align: alignments.has(element.align) ? element.align : "left",
                visible: element.visible !== false
            }))
    };
};

const normalizePayload = (payload = {}, existing = null) => {
    const baseTemplateId = String(payload.baseTemplateId || existing?.base_template_id || "").trim();
    const baseTemplate = cardTemplateService.getTemplate(baseTemplateId);
    if (!baseTemplate) {
        const error = new Error("Modèle de base invalide.");
        error.statusCode = 400;
        throw error;
    }

    const name = String(payload.name || existing?.name || "").trim();
    if (!name) {
        const error = new Error("Nom du modèle requis.");
        error.statusCode = 400;
        throw error;
    }

    const primaryColor = String(payload.primaryColor || existing?.primary_color || baseTemplate.accent).trim();
    const secondaryColor = String(payload.secondaryColor || existing?.secondary_color || baseTemplate.soft).trim();
    if (!colorPattern.test(primaryColor) || !colorPattern.test(secondaryColor)) {
        const error = new Error("Les couleurs doivent être au format hexadécimal, par exemple #2563eb.");
        error.statusCode = 400;
        throw error;
    }

    const qrPosition = String(payload.qrPosition || existing?.qr_position || "right").trim();
    if (!qrPositions.has(qrPosition)) {
        const error = new Error("Position QR invalide.");
        error.statusCode = 400;
        throw error;
    }

    return {
        base_template_id: baseTemplateId,
        name: name.slice(0, 80),
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        title: String(payload.title || existing?.title || baseTemplate.label).trim().slice(0, 80),
        card_message_default: String(payload.cardMessageDefault ?? existing?.card_message_default ?? "").trim().slice(0, 160) || null,
        logo_url: String(payload.logoUrl ?? existing?.logo_url ?? "").trim().slice(0, 500) || null,
        background_image_url: String(payload.backgroundImageUrl ?? existing?.background_image_url ?? "").trim().slice(0, 500) || null,
        qr_position: qrPosition,
        visible_fields: normalizeVisibleFields(payload.visibleFields || existing?.visible_fields),
        layout_config: normalizeLayoutConfig(payload.layoutConfig ?? existing?.layout_config),
        layout: String(payload.layout || existing?.layout || baseTemplate.layout || "wide").trim().slice(0, 32)
    };
};

const toApiTemplate = (template) => ({
    id: template.id,
    templateId: `custom:${template.id}`,
    baseTemplateId: template.base_template_id,
    name: template.name,
    primaryColor: template.primary_color,
    secondaryColor: template.secondary_color,
    title: template.title,
    cardMessageDefault: template.card_message_default || "",
    logoUrl: template.logo_url || "",
    backgroundImageUrl: template.background_image_url || "",
    qrPosition: template.qr_position,
    visibleFields: template.visible_fields,
    layoutConfig: template.layout_config || null,
    layout: template.layout,
    isDefault: template.is_default,
    createdAt: template.created_at,
    updatedAt: template.updated_at
});

exports.listForOrg = async (orgId) => {
    const [organization, templates] = await Promise.all([
        prisma.organization.findUnique({
            where: { org_id: orgId },
            select: { default_card_template_id: true }
        }),
        prisma.cardTemplateCustom.findMany({
            where: { org_id: orgId, deleted_at: null },
            orderBy: [{ is_default: "desc" }, { updated_at: "desc" }]
        })
    ]);

    return {
        defaultTemplateId: organization?.default_card_template_id || "",
        templates: templates.map(toApiTemplate)
    };
};

exports.findByIdForOrg = async (orgId, id) => prisma.cardTemplateCustom.findFirst({
    where: { id: Number(id), org_id: orgId, deleted_at: null }
});

exports.createForOrg = async (orgId, payload) => {
    const data = normalizePayload(payload);
    const template = await prisma.cardTemplateCustom.create({
        data: { ...data, org_id: orgId }
    });
    return toApiTemplate(template);
};

exports.updateForOrg = async (orgId, id, payload) => {
    const existing = await exports.findByIdForOrg(orgId, id);
    if (!existing) return null;

    const template = await prisma.cardTemplateCustom.update({
        where: { id: existing.id },
        data: normalizePayload(payload, existing)
    });
    return toApiTemplate(template);
};

exports.deleteForOrg = async (orgId, id) => {
    const existing = await exports.findByIdForOrg(orgId, id);
    if (!existing) return null;

    return prisma.$transaction(async (tx) => {
        await tx.cardTemplateCustom.update({
            where: { id: existing.id },
            data: { deleted_at: new Date(), is_default: false }
        });

        const customTemplateId = `custom:${existing.id}`;
        await tx.organization.updateMany({
            where: { org_id: orgId, default_card_template_id: customTemplateId },
            data: { default_card_template_id: null }
        });

        return existing;
    });
};

exports.duplicateForOrg = async (orgId, id) => {
    const existing = await exports.findByIdForOrg(orgId, id);
    if (!existing) return null;

    const template = await prisma.cardTemplateCustom.create({
        data: {
            org_id: orgId,
            base_template_id: existing.base_template_id,
            name: `${existing.name} copie`.slice(0, 80),
            primary_color: existing.primary_color,
            secondary_color: existing.secondary_color,
            title: existing.title,
            card_message_default: existing.card_message_default,
            logo_url: existing.logo_url,
            background_image_url: existing.background_image_url,
            qr_position: existing.qr_position,
            visible_fields: existing.visible_fields,
            layout_config: existing.layout_config,
            layout: existing.layout
        }
    });

    return toApiTemplate(template);
};

exports.setDefaultForOrg = async (orgId, templateId) => {
    const normalizedTemplateId = String(templateId || "").trim();
    if (!normalizedTemplateId) return null;

    let customId = null;
    if (cardTemplateService.hasTemplate(normalizedTemplateId)) {
        customId = null;
    } else {
        customId = cardTemplateService.extractCustomTemplateId(normalizedTemplateId);
        if (!customId) return null;
        const existing = await exports.findByIdForOrg(orgId, customId);
        if (!existing) return null;
    }

    await prisma.$transaction([
        prisma.cardTemplateCustom.updateMany({
            where: { org_id: orgId, deleted_at: null },
            data: { is_default: false }
        }),
        ...(customId ? [prisma.cardTemplateCustom.update({
            where: { id: customId },
            data: { is_default: true }
        })] : []),
        prisma.organization.update({
            where: { org_id: orgId },
            data: { default_card_template_id: normalizedTemplateId }
        })
    ]);

    return { defaultTemplateId: normalizedTemplateId };
};

exports.clearDefaultForOrg = async (orgId) => {
    await prisma.$transaction([
        prisma.cardTemplateCustom.updateMany({
            where: { org_id: orgId, deleted_at: null },
            data: { is_default: false }
        }),
        prisma.organization.update({
            where: { org_id: orgId },
            data: { default_card_template_id: null }
        })
    ]);
};

exports.getDefaultForOrg = async (orgId) => {
    const organization = await prisma.organization.findUnique({
        where: { org_id: orgId },
        select: { default_card_template_id: true }
    });

    return organization?.default_card_template_id || "";
};

exports.resolveCustomForRender = async (orgId, templateId) => {
    const customId = cardTemplateService.extractCustomTemplateId(templateId);
    if (!customId) return null;

    const template = await exports.findByIdForOrg(orgId, customId);
    if (!template) return null;

    return {
        baseTemplateId: template.base_template_id,
        customization: {
            id: template.id,
            name: template.name,
            primaryColor: template.primary_color,
            secondaryColor: template.secondary_color,
            title: template.title,
            cardMessageDefault: template.card_message_default,
            logoUrl: template.logo_url,
            backgroundImageUrl: template.background_image_url,
            qrPosition: template.qr_position,
            visibleFields: template.visible_fields,
            layoutConfig: template.layout_config,
            layout: template.layout
        }
    };
};
