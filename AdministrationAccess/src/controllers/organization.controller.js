const prisma = require('../lib/prisma');
const { writeAudit } = require('../services/audit.service');

const parseId = (value) => {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
};

exports.listOrganizations = async (req, res) => {
    try {
        const organizations = await prisma.organization.findMany({
            include: {
                plan: true,
                _count: {
                    select: { usersQ: true, events: true }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        res.render('organizations/list', {
            user: req.user,
            organizations,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error("Erreur listOrganizations:", error);
        res.render('organizations/list', {
            user: req.user,
            organizations: [],
            error: "Erreur lors du chargement des organisations.",
            success: null
        });
    }
};

exports.showOrganization = async (req, res) => {
    const orgId = parseId(req.params.id);
    if (!orgId) return res.redirect('/organizations?error=Organisation invalide.');

    try {
        const [organization, qrCodeCount] = await Promise.all([
            prisma.organization.findFirst({
                where: { org_id: orgId, deleted_at: null },
                include: {
                    plan: true,
                    subscription: {
                        select: {
                            status: true,
                            billing_interval: true,
                            current_period_start: true,
                            current_period_end: true,
                            cancel_at_period_end: true
                        }
                    },
                    usersQ: {
                        where: { role: { in: ['ORG_ADMIN', 'ORG_AGENT', 'OPERATOR'] } },
                        select: {
                            user_id: true,
                            full_name: true,
                            email: true,
                            role: true,
                            is_verified: true,
                            is_active: true,
                            suspended_by_plan: true,
                            deleted_at: true,
                            created_at: true,
                            last_login: true
                        },
                        orderBy: [{ role: 'asc' }, { created_at: 'asc' }]
                    },
                    _count: { select: { usersQ: true, events: true, areas: true, payments: true } }
                }
            }),
            prisma.qrCode.count({
                where: { deleted_at: null, event: { org_id: orgId, deleted_at: null } }
            })
        ]);

        if (!organization) {
            return res.redirect('/organizations?error=Organisation introuvable ou archivée.');
        }

        res.render('organizations/detail', {
            user: req.user,
            organization,
            administrators: organization.usersQ.filter(({ role }) => role === 'ORG_ADMIN'),
            agents: organization.usersQ.filter(({ role }) => role === 'ORG_AGENT' || role === 'OPERATOR'),
            qrCodeCount,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Erreur showOrganization:', error);
        res.redirect('/organizations?error=Erreur lors du chargement de l’organisation.');
    }
};

const parseLimit = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

exports.activateEnterprise = async (req, res) => {
    const orgId = parseId(req.params.id);
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
    const endsAt = new Date(req.body.endsAt);
    const reference = String(req.body.contractReference || "").trim();
    const limits = {
        maxEventsPerCycle: parseLimit(req.body.maxEventsPerCycle),
        maxQrCodesPerEvent: parseLimit(req.body.maxQrCodesPerEvent),
        maxAgents: parseLimit(req.body.maxAgents),
        maxAreas: parseLimit(req.body.maxAreas),
        capabilities: ["bulk_qr_import", "custom_card_templates", "scan_exports", "advanced_analytics"]
    };
    if (!orgId || !reference || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        return res.redirect('/organizations?error=Référence et dates de contrat invalides.');
    }
    if (Object.values(limits).slice(0, 4).some((value) => value === undefined)) {
        return res.redirect('/organizations?error=Les limites Entreprise doivent être des entiers positifs ou rester vides pour illimité.');
    }
    try {
        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`;
            const [organization, enterprise, openChanges] = await Promise.all([
                tx.organization.findUnique({ where: { org_id: orgId }, include: { plan: true } }),
                tx.plan.findFirst({ where: { title: "ENTERPRISE" } }),
                tx.$queryRaw`SELECT subscription_change_id FROM subscription_changes WHERE org_id = ${orgId} AND status IN ('AWAITING_PAYMENT', 'SCHEDULED', 'REFUND_PENDING') LIMIT 1`
            ]);
            if (!organization || !enterprise) throw new Error("ORGANIZATION_OR_PLAN_NOT_FOUND");
            if (openChanges.length > 0) throw new Error("OPEN_SUBSCRIPTION_CHANGE");
            const before = {
                plan: organization.plan?.title || null,
                startedAt: organization.subscription_started_at,
                expiresAt: organization.subscription_expires_at,
                contractReference: organization.enterprise_contract_reference,
                entitlements: organization.enterprise_entitlements
            };
            await tx.organization.update({
                where: { org_id: orgId },
                data: {
                    subscription_plan: enterprise.plan_id,
                    subscription_started_at: startsAt,
                    subscription_expires_at: endsAt,
                    subscription_interval: null,
                    enterprise_contract_reference: reference,
                    enterprise_entitlements: limits,
                    trial_expires_at: null
                }
            });
            await tx.subscription.upsert({
                where: { org_id: orgId },
                update: {
                    plan_id: enterprise.plan_id,
                    status: "ACTIVE",
                    billing_interval: null,
                    current_period_start: startsAt,
                    current_period_end: endsAt,
                    cancel_at_period_end: false,
                    version: { increment: 1 }
                },
                create: {
                    org_id: orgId,
                    plan_id: enterprise.plan_id,
                    status: "ACTIVE",
                    current_period_start: startsAt,
                    current_period_end: endsAt
                }
            });
            await tx.subscriptionPeriod.create({
                data: {
                    org_id: orgId,
                    plan_id: enterprise.plan_id,
                    starts_at: startsAt,
                    ends_at: endsAt,
                    source: "ENTERPRISE_CONTRACT",
                    entitlement_snapshot: { plan: "ENTERPRISE", limits }
                }
            });
            await tx.subscriptionAuditLog.create({
                data: {
                    org_id: orgId,
                actor_user_id: req.user?.id || null,
                    action: "ENTERPRISE_CONTRACT_ACTIVATED",
                    before_snapshot: before,
                    after_snapshot: { plan: "ENTERPRISE", startsAt, endsAt, contractReference: reference, entitlements: limits }
                }
            });
        });
        return res.redirect('/organizations?success=Contrat Entreprise activé avec historique d’audit.');
    } catch (error) {
        console.error("Erreur activateEnterprise:", error);
        const message = error.message === "OPEN_SUBSCRIPTION_CHANGE"
            ? "Un changement ou remboursement est déjà en cours pour cette organisation."
            : "Impossible d’activer le contrat Entreprise.";
        return res.redirect(`/organizations?error=${encodeURIComponent(message)}`);
    }
};

exports.deactivateOrganization = async (req, res) => {
    const orgId = parseId(req.params.id);
    if (!orgId) return res.redirect('/organizations?error=Organisation invalide.');
    try {
        const result = await prisma.organization.updateMany({
            where: { org_id: orgId, deleted_at: null },
            data: { is_active: false }
        });
        if (result.count === 0) return res.redirect('/organizations?error=Organisation introuvable ou archivée.');
        writeAudit({ actorId: req.user.id, action: 'ORGANIZATION_DEACTIVATED', targetType: 'ORGANIZATION', targetId: orgId, organizationId: orgId });

        res.redirect('/organizations?success=Organisation désactivée. Les états individuels des agents ont été conservés.');
    } catch (error) {
        console.error("Erreur deactivateOrganization:", error);
        res.redirect('/organizations?error=Erreur lors de la désactivation.');
    }
};

exports.archiveOrganization = async (req, res) => {
    const orgId = parseId(req.params.id);
    if (!orgId) return res.redirect('/organizations?error=Organisation invalide.');
    try {
        const archivedAt = new Date();
        await prisma.$transaction([
            prisma.organization.update({
                where: { org_id: orgId },
                data: { deleted_at: archivedAt, is_active: false }
            }),
            prisma.userQ.updateMany({
                where: { org_id: orgId },
                data: { deleted_at: archivedAt, is_active: false }
            })
        ]);

        res.redirect('/organizations?success=Organisation et utilisateurs archivés avec succès.');
    } catch (error) {
        console.error("Erreur archiveOrganization:", error);
        res.redirect('/organizations?error=Erreur lors de l\'archivage.');
    }
};

exports.activateOrganization = async (req, res) => {
    const orgId = parseId(req.params.id);
    if (!orgId) return res.redirect('/organizations?error=Organisation invalide.');
    try {
        const result = await prisma.organization.updateMany({
            where: { org_id: orgId, deleted_at: null },
            data: { is_active: true }
        });
        if (result.count === 0) return res.redirect('/organizations?error=Organisation introuvable ou archivée.');
        writeAudit({ actorId: req.user.id, action: 'ORGANIZATION_ACTIVATED', targetType: 'ORGANIZATION', targetId: orgId, organizationId: orgId });

        res.redirect('/organizations?success=Organisation réactivée. Les états individuels des agents ont été conservés.');
    } catch (error) {
        console.error("Erreur activateOrganization:", error);
        res.redirect('/organizations?error=Erreur lors de la réactivation.');
    }
};
