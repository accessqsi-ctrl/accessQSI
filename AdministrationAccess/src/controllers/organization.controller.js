const prisma = require('../lib/prisma');
const bcrypt = require('bcrypt');
const { writeAudit } = require('../services/audit.service');

const STANDARD_PLAN_CONFIG = Object.freeze({
    DISCOVERY: Object.freeze({ interval: null, months: null, status: 'CANCELED', maxAgents: 2, maxAreas: 2, maxEventsPerCycle: 1, maxQrCodesPerEvent: 50, capabilities: [] }),
    ESSENTIAL: Object.freeze({ months: { MONTHLY: 1, ANNUAL: 12 }, status: 'ACTIVE', maxAgents: 5, maxAreas: 6, maxEventsPerCycle: 5, maxQrCodesPerEvent: 200, capabilities: ['bulk_qr_import', 'scan_exports'] }),
    PRO: Object.freeze({ months: { MONTHLY: 1, ANNUAL: 12 }, status: 'ACTIVE', maxAgents: 10, maxAreas: 15, maxEventsPerCycle: 7, maxQrCodesPerEvent: 350, capabilities: ['bulk_qr_import', 'custom_card_templates', 'scan_exports', 'advanced_analytics'] })
});

// A subscription change reconciles quotas and writes several audit records.
// Remote PostgreSQL instances can exceed Prisma's 5-second interactive default.
const SUBSCRIPTION_TRANSACTION_OPTIONS = Object.freeze({
    maxWait: 5000,
    timeout: 20000
});

const addSubscriptionMonths = (date, months) => new Date(
    date.getTime() + months * 30 * 24 * 60 * 60 * 1000
);

const organizationPath = (orgId, type, message) => (
    `/organizations/${orgId}?${type}=${encodeURIComponent(message)}`
);

const verifySuperAdminPassword = async (req) => {
    const password = typeof req.body.superAdminPassword === 'string' ? req.body.superAdminPassword : '';
    if (!password) return false;
    const administrator = await prisma.userQ.findFirst({
        where: {
            user_id: Number(req.user?.id),
            role: 'SUPER_ADMIN',
            is_active: true,
            deleted_at: null
        },
        select: { password_hash: true }
    });
    return Boolean(administrator && await bcrypt.compare(password, administrator.password_hash));
};

const reconcilePlanResources = async (tx, orgId, config) => {
    const agents = await tx.userQ.findMany({
        where: { org_id: orgId, role: { in: ['ORG_AGENT', 'OPERATOR'] }, deleted_at: null },
        select: { user_id: true, is_active: true, suspended_by_plan: true },
        orderBy: [{ created_at: 'asc' }, { user_id: 'asc' }]
    });
    const retainedAgents = agents.filter((agent) => agent.is_active && !agent.suspended_by_plan);
    const agentCapacity = config.maxAgents == null
        ? agents.length
        : Math.max(0, config.maxAgents - retainedAgents.length);
    const restoredAgentIds = agents.filter((agent) => agent.suspended_by_plan).slice(0, agentCapacity).map((agent) => agent.user_id);
    const suspendedAgentIds = config.maxAgents == null
        ? []
        : retainedAgents.slice(config.maxAgents).map((agent) => agent.user_id);
    if (restoredAgentIds.length) {
        await tx.userQ.updateMany({ where: { user_id: { in: restoredAgentIds }, org_id: orgId }, data: { is_active: true, suspended_by_plan: false } });
    }
    if (suspendedAgentIds.length) {
        await tx.userQ.updateMany({ where: { user_id: { in: suspendedAgentIds }, org_id: orgId }, data: { is_active: false, suspended_by_plan: true } });
    }

    const areas = await tx.area.findMany({
        where: { org_id: orgId, deleted_at: null },
        select: { area_id: true, suspended_by_plan: true },
        orderBy: { area_id: 'asc' }
    });
    const retainedAreas = areas.filter((area) => !area.suspended_by_plan);
    const areaCapacity = config.maxAreas == null
        ? areas.length
        : Math.max(0, config.maxAreas - retainedAreas.length);
    const restoredAreaIds = areas.filter((area) => area.suspended_by_plan).slice(0, areaCapacity).map((area) => area.area_id);
    const suspendedAreaIds = config.maxAreas == null
        ? []
        : retainedAreas.slice(config.maxAreas).map((area) => area.area_id);
    if (restoredAreaIds.length) {
        await tx.area.updateMany({ where: { area_id: { in: restoredAreaIds }, org_id: orgId }, data: { suspended_by_plan: false } });
    }
    if (suspendedAreaIds.length) {
        await tx.area.updateMany({ where: { area_id: { in: suspendedAreaIds }, org_id: orgId }, data: { suspended_by_plan: true } });
    }
};

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
        if (!await verifySuperAdminPassword(req)) {
            writeAudit({ actorId: req.user.id, action: 'ENTERPRISE_CONTRACT_ACTIVATION', targetType: 'ORGANIZATION', targetId: orgId, organizationId: orgId, outcome: 'DENIED' });
            return res.redirect(organizationPath(orgId, 'error', 'Mot de passe incorrect. Le contrat n’a pas été modifié.'));
        }
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
            await reconcilePlanResources(tx, orgId, limits);
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
        }, SUBSCRIPTION_TRANSACTION_OPTIONS);
        return res.redirect(organizationPath(orgId, 'success', 'Contrat Entreprise activé avec historique d’audit.'));
    } catch (error) {
        console.error("Erreur activateEnterprise:", error);
        const message = error.code === 'P2028'
            ? 'La base de données a mis trop de temps à répondre. Aucun changement n’a été appliqué ; veuillez réessayer.'
            : error.message === "OPEN_SUBSCRIPTION_CHANGE"
                ? "Un changement ou remboursement est déjà en cours pour cette organisation."
                : "Impossible d’activer le contrat Entreprise.";
        return res.redirect(organizationPath(orgId, 'error', message));
    }
};

exports.changeSubscription = async (req, res) => {
    const orgId = parseId(req.params.id);
    const targetPlan = String(req.body.targetPlan || '').trim().toUpperCase();
    const config = STANDARD_PLAN_CONFIG[targetPlan];
    const interval = targetPlan === 'DISCOVERY'
        ? null
        : String(req.body.billingInterval || '').trim().toUpperCase();

    if (!orgId) return res.redirect('/organizations?error=Organisation invalide.');
    if (!config || (targetPlan !== 'DISCOVERY' && !Object.hasOwn(config.months, interval))) {
        return res.redirect(organizationPath(orgId, 'error', 'Le plan ou la période de facturation est invalide.'));
    }

    try {
        if (!await verifySuperAdminPassword(req)) {
            writeAudit({ actorId: req.user.id, action: 'SUBSCRIPTION_CHANGE', targetType: 'ORGANIZATION', targetId: orgId, organizationId: orgId, outcome: 'DENIED' });
            return res.redirect(organizationPath(orgId, 'error', 'Mot de passe incorrect. L’abonnement n’a pas été modifié.'));
        }

        const result = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`;
            const [organization, plan, openChanges] = await Promise.all([
                tx.organization.findFirst({
                    where: { org_id: orgId, deleted_at: null },
                    include: { plan: true, subscription: true }
                }),
                tx.plan.findUnique({ where: { title: targetPlan } }),
                tx.$queryRaw`SELECT subscription_change_id FROM subscription_changes WHERE org_id = ${orgId} AND status IN ('AWAITING_PAYMENT', 'SCHEDULED', 'REFUND_PENDING') LIMIT 1`
            ]);
            if (!organization || !plan) throw new Error('ORGANIZATION_OR_PLAN_NOT_FOUND');
            if (openChanges.length > 0) throw new Error('OPEN_SUBSCRIPTION_CHANGE');
            if (organization.plan?.title === targetPlan && (organization.subscription_interval || null) === interval) {
                throw new Error('SUBSCRIPTION_UNCHANGED');
            }

            const startsAt = new Date();
            const endsAt = config.months ? addSubscriptionMonths(startsAt, config.months[interval]) : null;
            const before = {
                plan: organization.plan?.title || null,
                interval: organization.subscription_interval,
                startsAt: organization.subscription_started_at,
                expiresAt: organization.subscription_expires_at,
                status: organization.subscription?.status || null
            };

            await reconcilePlanResources(tx, orgId, config);
            await tx.organization.update({
                where: { org_id: orgId },
                data: {
                    subscription_plan: plan.plan_id,
                    subscription_started_at: startsAt,
                    subscription_expires_at: endsAt,
                    subscription_interval: interval,
                    trial_expires_at: null,
                    enterprise_contract_reference: null,
                    enterprise_entitlements: null
                }
            });
            await tx.subscription.upsert({
                where: { org_id: orgId },
                update: {
                    plan_id: plan.plan_id,
                    status: config.status,
                    billing_interval: interval,
                    current_period_start: startsAt,
                    current_period_end: endsAt,
                    cancel_at_period_end: false,
                    version: { increment: 1 }
                },
                create: {
                    org_id: orgId,
                    plan_id: plan.plan_id,
                    status: config.status,
                    billing_interval: interval,
                    current_period_start: startsAt,
                    current_period_end: endsAt
                }
            });
            const snapshot = {
                plan: targetPlan,
                limits: {
                    maxEventsPerCycle: config.maxEventsPerCycle,
                    maxQrCodesPerEvent: config.maxQrCodesPerEvent,
                    maxAgents: config.maxAgents,
                    maxAreas: config.maxAreas
                },
                capabilities: config.capabilities
            };
            await tx.subscriptionPeriod.create({
                data: {
                    org_id: orgId,
                    plan_id: plan.plan_id,
                    billing_interval: interval,
                    starts_at: startsAt,
                    ends_at: endsAt,
                    source: 'SUPER_ADMIN_OVERRIDE',
                    entitlement_snapshot: snapshot
                }
            });
            await tx.subscriptionAuditLog.create({
                data: {
                    org_id: orgId,
                    actor_user_id: req.user.id,
                    action: 'SUPER_ADMIN_SUBSCRIPTION_CHANGED',
                    before_snapshot: before,
                    after_snapshot: { plan: targetPlan, interval, startsAt, expiresAt: endsAt }
                }
            });
            return { targetPlan, interval };
        }, SUBSCRIPTION_TRANSACTION_OPTIONS);

        writeAudit({ actorId: req.user.id, action: 'SUBSCRIPTION_CHANGED', targetType: 'ORGANIZATION', targetId: orgId, organizationId: orgId });
        const intervalLabel = result.interval === 'ANNUAL' ? ' annuel' : result.interval === 'MONTHLY' ? ' mensuel' : '';
        return res.redirect(organizationPath(orgId, 'success', `Abonnement ${result.targetPlan}${intervalLabel} appliqué avec succès.`));
    } catch (error) {
        console.error('Erreur changeSubscription:', error);
        const messages = {
            OPEN_SUBSCRIPTION_CHANGE: 'Un paiement, un changement ou un remboursement est déjà en cours pour cette organisation.',
            ORGANIZATION_OR_PLAN_NOT_FOUND: 'Organisation ou plan introuvable.',
            SUBSCRIPTION_UNCHANGED: 'Cette organisation utilise déjà ce plan et cette période.'
        };
        const message = error.code === 'P2028'
            ? 'La base de données a mis trop de temps à répondre. Aucun changement n’a été appliqué ; veuillez réessayer.'
            : messages[error.message] || 'Impossible de modifier l’abonnement.';
        return res.redirect(organizationPath(orgId, 'error', message));
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
