// Cycle de vie des abonnements : vue de facturation, essai Pro, annulation, changements planifiés.
const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../../prisma/client");
const pawaPay = require("../pawapay.service");
const logger = require("../../utils/logger");
const {
    PLAN_KEYS,
    BILLING_INTERVALS,
    PLAN_DETAILS,
    getPlanByKey,
    getPlanSummary,
    addUtcMonths,
    getTrialDurationDays
} = require("../../config/subscription");
const { PaymentValidationError, serializePayment } = require("./format");
const {
    OPEN_CHANGE_STATUSES,
    serializeChange,
    planSnapshot,
    enforceResourceLimits,
    recordSubscriptionAudit
} = require("./policy");

const ensureSubscription = async (db, organization) => {
    const fallbackPlan = organization.subscription_plan
        || (await getPlanByKey(db, PLAN_KEYS.DISCOVERY))?.plan_id;
    return db.subscription.upsert({
        where: { org_id: organization.org_id },
        update: {},
        create: {
            org_id: organization.org_id,
            plan_id: fallbackPlan,
            status: organization.trial_expires_at && new Date(organization.trial_expires_at) > new Date()
                ? "TRIALING"
                : organization.subscription_expires_at && new Date(organization.subscription_expires_at) <= new Date()
                    ? "EXPIRED"
                    : "ACTIVE",
            billing_interval: organization.subscription_interval,
            current_period_start: organization.subscription_started_at || organization.created_at || new Date(),
            current_period_end: organization.subscription_expires_at
        }
    });
};

const applyScheduledChange = async (changeId, now = new Date()) => prisma.$transaction(async (tx) => {
    const initial = await tx.subscriptionChange.findUnique({
        where: { subscription_change_id: changeId }
    });
    if (!initial || initial.status !== "SCHEDULED" || !initial.effective_at || initial.effective_at > now) return null;

    await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${initial.org_id} FOR UPDATE`);
    const change = await tx.subscriptionChange.findUnique({
        where: { subscription_change_id: changeId },
        include: { to_plan: true, payment: true }
    });
    if (!change || change.status !== "SCHEDULED" || change.effective_at > now) return null;

    const organization = await tx.organization.findUnique({ where: { org_id: change.org_id } });
    const subscription = await ensureSubscription(tx, organization);
    if (subscription.version !== change.source_version) {
        return tx.subscriptionChange.update({
            where: { subscription_change_id: changeId },
            data: { status: "REVIEW_REQUIRED", reason: "SUBSCRIPTION_VERSION_CHANGED" }
        });
    }

    const discovery = change.type === "CANCEL";
    const targetPlan = discovery
        ? await getPlanByKey(tx, PLAN_KEYS.DISCOVERY)
        : change.to_plan;
    const startsAt = change.effective_at;
    const expiresAt = discovery
        ? null
        : addUtcMonths(startsAt, change.to_interval === BILLING_INTERVALS.ANNUAL ? 12 : 1);

    // Cancellation never deletes customer data. Discovery limits are applied
    // automatically, without asking the customer to choose resources first.
    // Any legacy selection saved on a cancellation is deliberately ignored.
    await enforceResourceLimits(
        tx,
        change.org_id,
        targetPlan.title,
        discovery ? null : change.resource_selection
    );

    await tx.organization.update({
        where: { org_id: change.org_id },
        data: {
            subscription_plan: targetPlan.plan_id,
            subscription_started_at: startsAt,
            subscription_expires_at: expiresAt,
            subscription_interval: discovery ? null : change.to_interval,
            trial_expires_at: null
        }
    });
    await tx.subscription.update({
        where: { subscription_id: subscription.subscription_id },
        data: {
            plan_id: targetPlan.plan_id,
            status: discovery ? "CANCELED" : "ACTIVE",
            billing_interval: discovery ? null : change.to_interval,
            current_period_start: startsAt,
            current_period_end: expiresAt,
            cancel_at_period_end: false,
            version: { increment: 1 }
        }
    });
    await tx.subscriptionPeriod.create({
        data: {
            org_id: change.org_id,
            plan_id: targetPlan.plan_id,
            payment_id: change.payment?.payment_id || null,
            billing_interval: discovery ? null : change.to_interval,
            starts_at: startsAt,
            ends_at: expiresAt,
            source: change.type,
            entitlement_snapshot: planSnapshot(targetPlan.title)
        }
    });
    await recordSubscriptionAudit(tx, {
        org_id: change.org_id,
        action: `SUBSCRIPTION_CHANGE_${change.type}_APPLIED`,
        before_snapshot: { planId: change.from_plan_id, interval: change.from_interval },
        after_snapshot: { planId: targetPlan.plan_id, interval: discovery ? null : change.to_interval, startsAt, expiresAt }
    });
    return tx.subscriptionChange.update({
        where: { subscription_change_id: changeId },
        data: { status: "APPLIED", applied_at: now }
    });
});

const applyDueSubscriptionChanges = async (orgId = null, now = new Date()) => {
    const due = await prisma.subscriptionChange.findMany({
        where: {
            ...(orgId ? { org_id: orgId } : {}),
            status: "SCHEDULED",
            effective_at: { lte: now }
        },
        select: { subscription_change_id: true },
        orderBy: { effective_at: "asc" },
        take: 100
    });
    const results = [];
    for (const item of due) {
        results.push(await applyScheduledChange(item.subscription_change_id, now));
    }
    const expired = await prisma.subscription.findMany({
        where: {
            ...(orgId ? { org_id: orgId } : {}),
            status: { in: ["ACTIVE", "TRIALING"] },
            current_period_end: { lte: now }
        },
        select: { subscription_id: true, org_id: true }
    });
    for (const subscription of expired) {
        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${subscription.org_id} FOR UPDATE`);
            await enforceResourceLimits(tx, subscription.org_id, PLAN_KEYS.DISCOVERY);
            await tx.subscription.updateMany({
                where: {
                    subscription_id: subscription.subscription_id,
                    status: { in: ["ACTIVE", "TRIALING"] },
                    current_period_end: { lte: now }
                },
                data: { status: "EXPIRED" }
            });
        });
    }
    return results.filter(Boolean);
};

const getBillingOverview = async (orgId) => {
    await applyDueSubscriptionChanges(orgId);
    const [organization, payments, eventPasses, openChange] = await Promise.all([
        prisma.organization.findUnique({
            where: { org_id: orgId },
            include: { plan: true }
        }),
        prisma.payment.findMany({
            where: { org_id: orgId },
            include: {
                plan: true,
                subscription_change: { include: { from_plan: true, to_plan: true } }
            },
            orderBy: { created_at: "desc" },
            take: 20
        }),
        prisma.eventPass.findMany({
            where: { org_id: orgId },
            include: { event: { select: { event_id: true, title: true } } },
            orderBy: { purchased_at: "desc" }
        }),
        prisma.subscriptionChange.findFirst({
            where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } },
            include: { from_plan: true, to_plan: true },
            orderBy: { created_at: "desc" }
        })
    ]);
    if (!organization) {
        throw new PaymentValidationError("Organisation introuvable.", "ORGANIZATION_NOT_FOUND");
    }

    return {
        subscription: {
            ...getPlanSummary(organization),
            startedAt: organization.subscription_started_at,
            expiresAt: organization.subscription_expires_at,
            pendingChange: serializeChange(openChange)
        },
        payments: payments.map(serializePayment),
        eventPasses: eventPasses.map((pass) => ({
            id: pass.event_pass_id,
            status: pass.status,
            purchasedAt: pass.purchased_at,
            activatedAt: pass.activated_at,
            expiresAt: pass.expires_at,
            event: pass.event ? { id: pass.event.event_id, title: pass.event.title } : null
        }))
    };
};

const startProTrial = async (orgId) => {
    if (process.env.ENABLE_PRO_TRIAL !== "true") {
        throw new PaymentValidationError("L’essai Pro n’est pas proposé actuellement.", "TRIAL_NOT_OFFERED");
    }
    if (!orgId) {
        throw new PaymentValidationError("Organisation introuvable.", "ORGANIZATION_NOT_FOUND");
    }

    const [organization, proPlan] = await Promise.all([
        prisma.organization.findUnique({
            where: { org_id: orgId },
            include: { plan: true }
        }),
        getPlanByKey(prisma, PLAN_KEYS.PRO)
    ]);

    if (!organization || organization.deleted_at || !organization.is_active) {
        throw new PaymentValidationError("Organisation inactive ou introuvable.", "ORGANIZATION_NOT_FOUND");
    }
    if (organization.trial_started_at) {
        throw new PaymentValidationError(
            "L’essai Pro a déjà été utilisé par cette organisation.",
            "TRIAL_ALREADY_USED"
        );
    }
    const currentSummary = getPlanSummary(organization);
    if (currentSummary.isPaid) {
        throw new PaymentValidationError(
            "Un abonnement payant est déjà actif pour cette organisation.",
            "PAID_SUBSCRIPTION_ALREADY_ACTIVE"
        );
    }
    if (!proPlan) {
        throw new PaymentValidationError("Le plan Pro est indisponible.", "PRO_PLAN_NOT_FOUND");
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + getTrialDurationDays());

    const openChange = await prisma.subscriptionChange.findFirst({
        where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } }
    });
    if (openChange) {
        throw new PaymentValidationError(
            "Terminez ou annulez d’abord le changement d’abonnement en cours.",
            "SUBSCRIPTION_CHANGE_IN_PROGRESS"
        );
    }

    const activation = await prisma.$transaction(async (tx) => {
        const updated = await tx.organization.updateMany({
            where: {
                org_id: orgId,
                deleted_at: null,
                is_active: true,
                trial_started_at: null
            },
            data: {
                subscription_plan: proPlan.plan_id,
                subscription_started_at: now,
                subscription_expires_at: expiresAt,
                subscription_interval: BILLING_INTERVALS.MONTHLY,
                trial_started_at: now,
                trial_expires_at: expiresAt
            }
        });
        if (updated.count !== 1) return updated;
        await tx.subscription.upsert({
            where: { org_id: orgId },
            update: {
                plan_id: proPlan.plan_id,
                status: "TRIALING",
                billing_interval: BILLING_INTERVALS.MONTHLY,
                current_period_start: now,
                current_period_end: expiresAt,
                cancel_at_period_end: false,
                version: { increment: 1 }
            },
            create: {
                org_id: orgId,
                plan_id: proPlan.plan_id,
                status: "TRIALING",
                billing_interval: BILLING_INTERVALS.MONTHLY,
                current_period_start: now,
                current_period_end: expiresAt
            }
        });
        await tx.subscriptionPeriod.create({
            data: {
                org_id: orgId,
                plan_id: proPlan.plan_id,
                billing_interval: BILLING_INTERVALS.MONTHLY,
                starts_at: now,
                ends_at: expiresAt,
                source: "TRIAL",
                entitlement_snapshot: planSnapshot(PLAN_KEYS.PRO)
            }
        });
        return updated;
    });

    if (activation.count !== 1) {
        throw new PaymentValidationError(
            "L’essai Pro a déjà été activé ou l’organisation n’est plus disponible.",
            "TRIAL_NOT_AVAILABLE"
        );
    }

    const updatedOrganization = await prisma.organization.findUnique({
        where: { org_id: orgId },
        include: { plan: true }
    });
    logger.info("subscription.trial_started", {
        org_id: orgId,
        expires_at: expiresAt
    });
    return getPlanSummary(updatedOrganization);
};

const requestCancellation = async (orgId) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`);
    const organization = await tx.organization.findUnique({
        where: { org_id: orgId },
        include: { plan: true }
    });
    if (!organization || !getPlanSummary(organization).isPaid || !organization.subscription_expires_at) {
        throw new PaymentValidationError("Aucun abonnement payant actif ne peut être annulé.", "NO_ACTIVE_PAID_SUBSCRIPTION");
    }
    const open = await tx.subscriptionChange.findFirst({
        where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } }
    });
    if (open) {
        throw new PaymentValidationError("Un changement d’abonnement est déjà en cours.", "SUBSCRIPTION_CHANGE_IN_PROGRESS");
    }
    const subscription = await ensureSubscription(tx, organization);
    const discovery = await getPlanByKey(tx, PLAN_KEYS.DISCOVERY);
    const change = await tx.subscriptionChange.create({
        data: {
            org_id: orgId,
            subscription_id: subscription.subscription_id,
            from_plan_id: organization.subscription_plan,
            to_plan_id: discovery.plan_id,
            from_interval: organization.subscription_interval,
            type: "CANCEL",
            status: "SCHEDULED",
            effective_at: organization.subscription_expires_at,
            source_version: subscription.version
        },
        include: { from_plan: true, to_plan: true }
    });
    await tx.subscription.update({
        where: { subscription_id: subscription.subscription_id },
        data: { cancel_at_period_end: true }
    });
    await recordSubscriptionAudit(tx, {
        org_id: orgId,
        action: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
        before_snapshot: { planId: organization.subscription_plan, expiresAt: organization.subscription_expires_at },
        after_snapshot: { planId: discovery.plan_id, effectiveAt: organization.subscription_expires_at }
    });
    return serializeChange(change);
});

const cancelOpenChange = async (orgId) => {
    const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`);
        const change = await tx.subscriptionChange.findFirst({
            where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } },
            include: { payment: true, from_plan: true, to_plan: true },
            orderBy: { created_at: "desc" }
        });
        if (!change) {
            throw new PaymentValidationError("Aucun changement d’abonnement n’est en cours.", "NO_SUBSCRIPTION_CHANGE");
        }
        if (change.status === "REFUND_PENDING") {
            throw new PaymentValidationError("Le remboursement est déjà en cours.", "REFUND_ALREADY_PENDING");
        }
        if (change.status === "SCHEDULED" && change.payment?.status === "COMPLETED") {
            const refund = await tx.refund.create({
                data: {
                    provider_refund_id: crypto.randomUUID(),
                    payment_id: change.payment.payment_id,
                    org_id: orgId,
                    reason: "CANCELED_SCHEDULED_SUBSCRIPTION_CHANGE"
                }
            });
            const pending = await tx.subscriptionChange.update({
                where: { subscription_change_id: change.subscription_change_id },
                data: { status: "REFUND_PENDING", reason: "REFUND_REQUESTED_BY_CUSTOMER" },
                include: { from_plan: true, to_plan: true }
            });
            await tx.payment.update({
                where: { payment_id: change.payment.payment_id },
                data: { status: "REFUND_PENDING" }
            });
            return { change: pending, refund, depositId: change.payment.deposit_id };
        }
        const canceled = await tx.subscriptionChange.update({
            where: { subscription_change_id: change.subscription_change_id },
            data: { status: "CANCELED", canceled_at: new Date(), reason: "CANCELED_BY_CUSTOMER" },
            include: { from_plan: true, to_plan: true }
        });
        if (change.subscription_id) {
            await tx.subscription.update({
                where: { subscription_id: change.subscription_id },
                data: { cancel_at_period_end: false }
            });
        }
        return { change: canceled, refund: null };
    });

    if (!result.refund) return serializeChange(result.change);
    try {
        const response = await pawaPay.initiateRefund({
            refundId: result.refund.provider_refund_id,
            depositId: result.depositId
        });
        const accepted = ["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status);
        await prisma.refund.update({
            where: { refund_id: result.refund.refund_id },
            data: accepted ? {
                status: response?.status === "PROCESSING" ? "PROCESSING" : "PENDING",
                provider_payload: response
            } : {
                status: "FAILED",
                failure_code: response?.failureReason?.failureCode || response?.status || "REJECTED",
                failure_message: response?.failureReason?.failureMessage || "Le remboursement a été rejeté.",
                provider_payload: response
            }
        });
        if (!accepted) {
            await prisma.$transaction([
                prisma.subscriptionChange.update({
                    where: { subscription_change_id: result.change.subscription_change_id },
                    data: { status: "SCHEDULED", reason: "REFUND_REJECTED" }
                }),
                prisma.payment.update({
                    where: { payment_id: result.refund.payment_id },
                    data: { status: "COMPLETED" }
                })
            ]);
            throw new PaymentValidationError(
                "Le remboursement a été rejeté. Le changement reste programmé.",
                "REFUND_REJECTED"
            );
        }
        return serializeChange(result.change);
    } catch (error) {
        if (error instanceof PaymentValidationError) throw error;
        logger.error("refund.initiation_uncertain", {
            refund_id: result.refund.refund_id,
            payment_id: result.refund.payment_id,
            org_id: orgId,
            error
        });
        return serializeChange(result.change);
    }
};

const selectRetainedResources = async (orgId, { agentIds = [], areaIds = [] } = {}) => {
    const normalizedAgentIds = [...new Set(agentIds.map(Number).filter(Number.isInteger))];
    const normalizedAreaIds = [...new Set(areaIds.map(Number).filter(Number.isInteger))];
    const change = await prisma.subscriptionChange.findFirst({
        where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } },
        include: { to_plan: true, from_plan: true },
        orderBy: { created_at: "desc" }
    });
    if (!change || !["DOWNGRADE", "INTERVAL_CHANGE"].includes(change.type)) {
        throw new PaymentValidationError("Aucun downgrade ne nécessite une sélection de ressources.", "NO_DOWNGRADE_RESOURCE_SELECTION");
    }
    const targetKey = change.to_plan?.title;
    const details = PLAN_DETAILS[targetKey] || PLAN_DETAILS.DISCOVERY;
    if (details.maxAgents != null && normalizedAgentIds.length > details.maxAgents) {
        throw new PaymentValidationError(`Vous pouvez conserver au maximum ${details.maxAgents} agents actifs.`, "TOO_MANY_RETAINED_AGENTS");
    }
    if (details.maxAreas != null && normalizedAreaIds.length > details.maxAreas) {
        throw new PaymentValidationError(`Vous pouvez conserver au maximum ${details.maxAreas} zones actives.`, "TOO_MANY_RETAINED_AREAS");
    }
    const [agents, areas] = await Promise.all([
        prisma.userQ.count({
            where: {
                user_id: { in: normalizedAgentIds },
                org_id: orgId,
                role: { in: ["ORG_AGENT", "OPERATOR"] },
                deleted_at: null,
                is_active: true
            }
        }),
        prisma.area.count({
            where: { area_id: { in: normalizedAreaIds }, org_id: orgId, deleted_at: null, suspended_by_plan: false }
        })
    ]);
    if (agents !== normalizedAgentIds.length || areas !== normalizedAreaIds.length) {
        throw new PaymentValidationError("Une ressource sélectionnée est inactive ou appartient à une autre organisation.", "INVALID_RETAINED_RESOURCE");
    }
    const updated = await prisma.subscriptionChange.update({
        where: { subscription_change_id: change.subscription_change_id },
        data: { resource_selection: { agentIds: normalizedAgentIds, areaIds: normalizedAreaIds } },
        include: { from_plan: true, to_plan: true }
    });
    return serializeChange(updated);
};

module.exports = {
    ensureSubscription,
    applyScheduledChange,
    applyDueSubscriptionChanges,
    getBillingOverview,
    startProTrial,
    requestCancellation,
    cancelOpenChange,
    selectRetainedResources
};
