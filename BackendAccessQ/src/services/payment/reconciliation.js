// Réconciliation des dépôts et remboursements avec pawaPay.
const { Prisma } = require("@prisma/client");
const prisma = require("../../prisma/client");
const pawaPay = require("../pawapay.service");
const logger = require("../../utils/logger");
const { PLAN_KEYS, BILLING_INTERVALS, addUtcMonths } = require("../../config/subscription");
const { PaymentValidationError, extractPawaPayFailure, serializePayment } = require("./format");
const {
    planSnapshot,
    recordSubscriptionAudit,
    classifyChange,
    arePaymentsEnabled
} = require("./policy");
const { ensureSubscription } = require("./subscription");

const unwrapDepositStatus = (response) => {
    if (response?.status === "FOUND" && response.data) return response.data;
    if (response?.depositId) return response;
    return null;
};

const amountsMatch = (expected, received) => {
    try {
        return new Prisma.Decimal(expected).equals(new Prisma.Decimal(received));
    } catch {
        return false;
    }
};

const reconcileRefund = async (providerRefundId) => {
    const existing = await prisma.refund.findUnique({
        where: { provider_refund_id: providerRefundId },
        include: { payment: { include: { subscription_change: true } } }
    });
    if (!existing) return null;
    if (["COMPLETED", "FAILED"].includes(existing.status)) return existing;

    const response = await pawaPay.checkRefund(providerRefundId);
    const remote = response?.status === "FOUND" && response.data ? response.data : response;
    if (!remote || (remote.refundId && remote.refundId !== providerRefundId)) return existing;
    if (remote.status === "COMPLETED") {
        return prisma.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${existing.org_id} FOR UPDATE`);
            const refund = await tx.refund.update({
                where: { refund_id: existing.refund_id },
                data: {
                    status: "COMPLETED",
                    provider_transaction_id: remote.providerTransactionId || null,
                    provider_payload: remote,
                    failure_code: null,
                    failure_message: null,
                    completed_at: new Date()
                }
            });
            await tx.payment.update({
                where: { payment_id: existing.payment_id },
                data: { status: "REFUNDED" }
            });
            const change = existing.payment.subscription_change;
            if (change) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: change.subscription_change_id },
                    data: { status: "CANCELED", canceled_at: new Date(), reason: "PAYMENT_REFUNDED" }
                });
                if (change.subscription_id) {
                    await tx.subscription.update({
                        where: { subscription_id: change.subscription_id },
                        data: { cancel_at_period_end: false }
                    });
                }
            }
            return refund;
        });
    }
    if (remote.status === "FAILED") {
        const failure = remote.failureReason || {};
        await prisma.$transaction(async (tx) => {
            await tx.refund.update({
                where: { refund_id: existing.refund_id },
                data: {
                    status: "FAILED",
                    failure_code: failure.failureCode || "FAILED",
                    failure_message: failure.failureMessage || "Le remboursement a échoué.",
                    provider_payload: remote
                }
            });
            await tx.payment.update({
                where: { payment_id: existing.payment_id },
                data: { status: "COMPLETED" }
            });
            if (existing.payment.subscription_change) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: existing.payment.subscription_change.subscription_change_id },
                    data: { status: "SCHEDULED", reason: "REFUND_FAILED" }
                });
            }
        });
    } else {
        await prisma.refund.update({
            where: { refund_id: existing.refund_id },
            data: { status: "PROCESSING", provider_payload: remote }
        });
    }
    return prisma.refund.findUnique({ where: { provider_refund_id: providerRefundId } });
};

const reconcilePayment = async (depositId) => {
    if (!arePaymentsEnabled()) {
        throw new PaymentValidationError(
            "Les paiements sont temporairement indisponibles.",
            "PAYMENTS_DISABLED"
        );
    }

    const existing = await prisma.payment.findUnique({
        where: { deposit_id: depositId },
        include: {
            plan: true,
            subscription_change: { include: { from_plan: true, to_plan: true } }
        }
    });
    if (!existing) return null;
    if (["COMPLETED", "REFUNDED", "REVIEW_REQUIRED"].includes(existing.status)) return serializePayment(existing);

    const statusResponse = await pawaPay.checkDeposit(depositId);
    const remote = unwrapDepositStatus(statusResponse);
    if (!remote) return serializePayment(existing);
    if (
        remote.depositId !== existing.deposit_id
        || !amountsMatch(existing.amount, remote.amount)
        || remote.currency !== existing.currency
        || (remote.country && remote.country !== existing.country)
        || (
            remote.payer?.accountDetails?.provider
            && remote.payer.accountDetails.provider !== existing.provider
        )
        || (
            remote.payer?.accountDetails?.phoneNumber
            && remote.payer.accountDetails.phoneNumber !== existing.phone_number
        )
    ) {
        logger.error("payment.reconciliation_mismatch", {
            payment_id: existing.payment_id,
            deposit_id: depositId,
            org_id: existing.org_id
        });
        throw new PaymentValidationError(
            "Les données du paiement ne correspondent pas à la transaction attendue.",
            "PAYMENT_RECONCILIATION_MISMATCH"
        );
    }

    if (remote.status === "COMPLETED") {
        const completed = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw(
                Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${existing.org_id} FOR UPDATE`
            );
            const current = await tx.payment.findUnique({
                where: { payment_id: existing.payment_id },
                include: {
                    plan: true,
                    subscription_change: { include: { from_plan: true, to_plan: true } }
                }
            });
            if (current.status === "COMPLETED") return current;

            const now = new Date();
            if (current.plan.title === PLAN_KEYS.EVENT_PASS) {
                await tx.eventPass.create({
                    data: {
                        org_id: current.org_id,
                        payment_id: current.payment_id,
                        status: "AVAILABLE"
                    }
                });
                return tx.payment.update({
                    where: { payment_id: current.payment_id },
                    data: {
                        status: "COMPLETED",
                        provider_transaction_id: remote.providerTransactionId || null,
                        failure_code: null,
                        failure_message: null,
                        access_starts_at: null,
                        access_expires_at: null,
                        completed_at: now,
                        provider_payload: remote
                    },
                    include: { plan: true }
                });
            }

            const organization = await tx.organization.findUnique({
                where: { org_id: existing.org_id },
                include: { plan: true }
            });
            const subscription = await ensureSubscription(tx, organization);
            let change = current.subscription_change;
            if (!change) {
                const legacyTransition = classifyChange({
                    organization,
                    targetPlan: current.plan.title,
                    targetInterval: current.billing_interval,
                    now
                });
                change = await tx.subscriptionChange.create({
                    data: {
                        org_id: current.org_id,
                        subscription_id: subscription.subscription_id,
                        from_plan_id: organization.subscription_plan,
                        to_plan_id: current.plan_id,
                        from_interval: organization.subscription_interval,
                        to_interval: current.billing_interval,
                        type: legacyTransition.type,
                        status: "AWAITING_PAYMENT",
                        effective_at: legacyTransition.effectiveAt,
                        quoted_amount: current.amount,
                        quoted_currency: current.currency,
                        reference_amount: current.reference_amount,
                        reference_currency: current.reference_currency,
                        source_version: subscription.version,
                        payment: { connect: { payment_id: current.payment_id } }
                    },
                    include: { from_plan: true, to_plan: true }
                });
            }

            if (change.status !== "AWAITING_PAYMENT" || subscription.version !== change.source_version) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: change.subscription_change_id },
                    data: {
                        status: "REVIEW_REQUIRED",
                        reason: change.status !== "AWAITING_PAYMENT"
                            ? `PAYMENT_COMPLETED_AFTER_${change.status}`
                            : "SUBSCRIPTION_VERSION_CHANGED"
                    }
                });
                return tx.payment.update({
                    where: { payment_id: current.payment_id },
                    data: {
                        status: "REVIEW_REQUIRED",
                        provider_transaction_id: remote.providerTransactionId || null,
                        completed_at: now,
                        provider_payload: remote
                    },
                    include: { plan: true, subscription_change: true }
                });
            }

            const scheduled = change.effective_at && change.effective_at > now
                && ["DOWNGRADE", "INTERVAL_CHANGE"].includes(change.type);
            const scheduledExpiresAt = scheduled
                ? addUtcMonths(change.effective_at, change.to_interval === BILLING_INTERVALS.ANNUAL ? 12 : 1)
                : null;
            if (scheduled) {
                await tx.subscriptionChange.update({
                    where: { subscription_change_id: change.subscription_change_id },
                    data: { status: "SCHEDULED" }
                });
                return tx.payment.update({
                    where: { payment_id: current.payment_id },
                    data: {
                        status: "COMPLETED",
                        provider_transaction_id: remote.providerTransactionId || null,
                        failure_code: null,
                        failure_message: null,
                        access_starts_at: change.effective_at,
                        access_expires_at: scheduledExpiresAt,
                        completed_at: now,
                        provider_payload: remote
                    },
                    include: { plan: true, subscription_change: { include: { from_plan: true, to_plan: true } } }
                });
            }

            const currentExpiry = organization.subscription_expires_at
                ? new Date(organization.subscription_expires_at)
                : null;
            const renewal = change.type === "RENEWAL" && currentExpiry && currentExpiry > now;
            const upgrade = change.type === "UPGRADE" && currentExpiry && currentExpiry > now;
            const startsAt = renewal ? currentExpiry : now;
            const expiresAt = upgrade
                ? currentExpiry
                : addUtcMonths(startsAt, current.billing_interval === BILLING_INTERVALS.ANNUAL ? 12 : 1);
            const subscriptionStartedAt = renewal || upgrade
                ? organization.subscription_started_at || now
                : now;

            await tx.organization.update({
                where: { org_id: existing.org_id },
                data: {
                    subscription_plan: existing.plan_id,
                    subscription_started_at: subscriptionStartedAt,
                    subscription_expires_at: expiresAt,
                    subscription_interval: current.billing_interval,
                    trial_expires_at: organization.trial_expires_at && new Date(organization.trial_expires_at) <= now
                        ? null
                        : organization.trial_expires_at
                }
            });
            await tx.subscription.update({
                where: { subscription_id: subscription.subscription_id },
                data: {
                    plan_id: current.plan_id,
                    status: "ACTIVE",
                    billing_interval: current.billing_interval,
                    current_period_start: subscriptionStartedAt,
                    current_period_end: expiresAt,
                    cancel_at_period_end: false,
                    version: { increment: 1 }
                }
            });
            await tx.subscriptionPeriod.create({
                data: {
                    org_id: current.org_id,
                    plan_id: current.plan_id,
                    payment_id: current.payment_id,
                    billing_interval: current.billing_interval,
                    starts_at: startsAt,
                    ends_at: expiresAt,
                    source: change.type,
                    entitlement_snapshot: planSnapshot(current.plan.title)
                }
            });
            await recordSubscriptionAudit(tx, {
                org_id: current.org_id,
                actor_user_id: current.initiated_by_id,
                action: `SUBSCRIPTION_CHANGE_${change.type}_APPLIED`,
                before_snapshot: { planId: change.from_plan_id, interval: change.from_interval },
                after_snapshot: { planId: current.plan_id, interval: current.billing_interval, startsAt, expiresAt }
            });
            await tx.subscriptionChange.update({
                where: { subscription_change_id: change.subscription_change_id },
                data: { status: "APPLIED", applied_at: now }
            });
            return tx.payment.update({
                where: { payment_id: existing.payment_id },
                data: {
                    status: "COMPLETED",
                    provider_transaction_id: remote.providerTransactionId || null,
                    failure_code: null,
                    failure_message: null,
                    access_starts_at: startsAt,
                    access_expires_at: expiresAt,
                    completed_at: now,
                    provider_payload: remote
                },
                include: {
                    plan: true,
                    subscription_change: { include: { from_plan: true, to_plan: true } }
                }
            });
        });

        logger.info("payment.completed", {
            payment_id: completed.payment_id,
            deposit_id: depositId,
            org_id: completed.org_id
        });
        return serializePayment(completed);
    }

    const failure = remote.failureReason || {};
    if (remote.status === "FAILED") {
        logger.warn("payment.pawapay_failed", {
            payment_id: existing.payment_id,
            deposit_id: depositId,
            org_id: existing.org_id,
            pawapay_failure_code: failure.failureCode || "FAILED",
            pawapay_failure_message: failure.failureMessage || null
        });
    }
    const updated = await prisma.payment.update({
        where: { payment_id: existing.payment_id },
        data: {
            status: remote.status === "FAILED" ? "FAILED" : "PROCESSING",
            provider_transaction_id: remote.providerTransactionId || null,
            failure_code: remote.status === "FAILED" ? failure.failureCode || "FAILED" : null,
            failure_message: remote.status === "FAILED"
                ? failure.failureMessage || failure.failureCode || "FAILED"
                : null,
            provider_payload: remote
        },
        include: {
            plan: true,
            subscription_change: { include: { from_plan: true, to_plan: true } }
        }
    });
    if (remote.status === "FAILED" && existing.subscription_change_id) {
        await prisma.subscriptionChange.update({
            where: { subscription_change_id: existing.subscription_change_id },
            data: { status: "FAILED", reason: failure.failureCode || "FAILED" }
        });
    }
    return serializePayment(updated);
};

const reconcilePendingTransactions = async (now = new Date()) => {
    if (!arePaymentsEnabled()) return { payments: 0, refunds: 0 };
    const retryBefore = new Date(now.getTime() - 2 * 60 * 1000);
    const expireBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [payments, refunds] = await Promise.all([
        prisma.payment.findMany({
            where: { status: { in: ["PENDING", "PROCESSING"] }, created_at: { lte: retryBefore } },
            select: { payment_id: true, deposit_id: true, created_at: true, subscription_change_id: true },
            orderBy: { created_at: "asc" },
            take: 50
        }),
        prisma.refund.findMany({
            where: { status: { in: ["PENDING", "PROCESSING"] }, created_at: { lte: retryBefore } },
            select: { provider_refund_id: true },
            orderBy: { created_at: "asc" },
            take: 50
        })
    ]);
    for (const payment of payments) {
        try {
            const result = await reconcilePayment(payment.deposit_id);
            if (payment.created_at <= expireBefore && ["PENDING", "PROCESSING"].includes(result?.status)) {
                await prisma.$transaction(async (tx) => {
                    await tx.payment.update({
                        where: { payment_id: payment.payment_id },
                        data: { status: "EXPIRED", failure_code: "PAYMENT_EXPIRED", failure_message: "La demande de paiement a expiré." }
                    });
                    if (payment.subscription_change_id) {
                        await tx.subscriptionChange.update({
                            where: { subscription_change_id: payment.subscription_change_id },
                            data: { status: "EXPIRED", reason: "PAYMENT_EXPIRED" }
                        });
                    }
                });
            }
        } catch (error) {
            const rawFailure = extractPawaPayFailure(error.responseData);
            logger.warn("payment.background_reconciliation_failed", {
                deposit_id: payment.deposit_id,
                pawapay_failure_code: rawFailure.code,
                pawapay_failure_message: rawFailure.message,
                error
            });
        }
    }
    for (const refund of refunds) {
        try {
            await reconcileRefund(refund.provider_refund_id);
        } catch (error) {
            logger.warn("refund.background_reconciliation_failed", { refund_id: refund.provider_refund_id, error });
        }
    }
    return { payments: payments.length, refunds: refunds.length };
};

module.exports = {
    unwrapDepositStatus,
    amountsMatch,
    reconcileRefund,
    reconcilePayment,
    reconcilePendingTransactions
};
