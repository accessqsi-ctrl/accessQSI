// Devis et initiation des dépôts pawaPay.
const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../../prisma/client");
const pawaPay = require("../pawapay.service");
const logger = require("../../utils/logger");
const { getPaymentConfig } = require("../../config/payment");
const { PLAN_KEYS, BILLING_INTERVALS, getPlanByKey } = require("../../config/subscription");
const {
    PaymentValidationError,
    normalizePhoneNumber,
    buildPaymentReason,
    buildProviderCustomerMessage,
    extractPawaPayFailure,
    serializePayment
} = require("./format");
const { OPEN_CHANGE_STATUSES, calculatePaymentQuote } = require("./policy");
const { findProvider } = require("./catalog");
const { ensureSubscription } = require("./subscription");

const getPaymentQuote = async ({ orgId, planKey, billingInterval, providerCode, countryCode, currencyCode }) => {
    const normalizedPlan = String(planKey || "").trim().toUpperCase();
    if (![PLAN_KEYS.ESSENTIAL, PLAN_KEYS.PRO, PLAN_KEYS.EVENT_PASS].includes(normalizedPlan)) {
        throw new PaymentValidationError("Ce produit ne peut pas être acheté.", "PLAN_NOT_PURCHASABLE");
    }
    const normalizedInterval = String(billingInterval || (
        normalizedPlan === PLAN_KEYS.EVENT_PASS ? BILLING_INTERVALS.ONE_TIME : BILLING_INTERVALS.MONTHLY
    )).trim().toUpperCase();
    const allowed = normalizedPlan === PLAN_KEYS.ESSENTIAL
        ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
        : normalizedPlan === PLAN_KEYS.PRO
            ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
            : [BILLING_INTERVALS.ONE_TIME];
    if (!allowed.includes(normalizedInterval)) {
        throw new PaymentValidationError("Cette périodicité n’est pas disponible pour ce produit.", "BILLING_INTERVAL_NOT_AVAILABLE");
    }
    const [organization, plan, provider] = await Promise.all([
        prisma.organization.findUnique({ where: { org_id: orgId }, include: { plan: true } }),
        getPlanByKey(prisma, normalizedPlan),
        findProvider(providerCode, countryCode, currencyCode)
    ]);
    if (!organization || organization.deleted_at || !organization.is_active || !plan) {
        throw new PaymentValidationError("Organisation ou plan introuvable.", "ORGANIZATION_NOT_FOUND");
    }
    const quote = calculatePaymentQuote({
        organization,
        plan,
        provider,
        billingInterval: normalizedInterval
    });
    return {
        plan: normalizedPlan,
        billingInterval: normalizedInterval,
        reason: buildPaymentReason({
            planKey: normalizedPlan,
            billingInterval: normalizedInterval,
            transitionType: quote.transition?.type
        }),
        amount: String(quote.localPrice),
        currency: provider.currency,
        referenceAmount: String(quote.referencePrice),
        referenceCurrency: plan.currency,
        creditAmount: String(quote.creditAmount),
        transition: quote.transition ? {
            type: quote.transition.type,
            effectiveAt: quote.transition.effectiveAt,
            prorated: quote.transition.prorated
        } : null
    };
};

const initiatePayment = async ({ orgId, userId, planKey, billingInterval, providerCode, countryCode, currencyCode, phoneNumber }) => {
    const paymentConfig = getPaymentConfig();
    if (!paymentConfig.enabled) {
        throw new PaymentValidationError(
            "Les paiements sont temporairement indisponibles.",
            "PAYMENTS_DISABLED"
        );
    }

    const normalizedPlan = String(planKey || "").trim().toUpperCase();
    if (![PLAN_KEYS.ESSENTIAL, PLAN_KEYS.PRO, PLAN_KEYS.EVENT_PASS].includes(normalizedPlan)) {
        throw new PaymentValidationError("Ce produit ne peut pas être acheté.", "PLAN_NOT_PURCHASABLE");
    }
    const defaultInterval = normalizedPlan === PLAN_KEYS.EVENT_PASS
        ? BILLING_INTERVALS.ONE_TIME
        : BILLING_INTERVALS.MONTHLY;
    const normalizedInterval = String(billingInterval || defaultInterval).trim().toUpperCase();
    const allowedIntervals = normalizedPlan === PLAN_KEYS.ESSENTIAL
        ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
        : normalizedPlan === PLAN_KEYS.PRO
            ? [BILLING_INTERVALS.MONTHLY, BILLING_INTERVALS.ANNUAL]
            : [BILLING_INTERVALS.ONE_TIME];
    if (!allowedIntervals.includes(normalizedInterval)) {
        throw new PaymentValidationError("Cette périodicité n’est pas disponible pour ce produit.", "BILLING_INTERVAL_NOT_AVAILABLE");
    }

    const [organization, plan, provider] = await Promise.all([
        prisma.organization.findUnique({ where: { org_id: orgId }, include: { plan: true } }),
        getPlanByKey(prisma, normalizedPlan),
        findProvider(providerCode, countryCode, currencyCode)
    ]);
    if (!organization || organization.deleted_at || !organization.is_active) {
        throw new PaymentValidationError("Organisation inactive ou introuvable.", "ORGANIZATION_NOT_FOUND");
    }
    if (!plan || plan.cost <= 0) {
        throw new PaymentValidationError("Le tarif du plan est invalide.", "INVALID_PLAN_PRICE");
    }
    const normalizedPhone = normalizePhoneNumber(phoneNumber, {
        country: provider.country,
        prefix: provider.prefix
    });
    const now = new Date();
    const { transition, localPrice, referencePrice } = calculatePaymentQuote({
        organization,
        plan,
        provider,
        billingInterval: normalizedInterval,
        now
    });

    const depositId = crypto.randomUUID();
    let payment;
    try {
        payment = await prisma.$transaction(async (tx) => {
            let subscriptionChangeId = null;
            if (normalizedPlan !== PLAN_KEYS.EVENT_PASS) {
                await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`);
                const openChange = await tx.subscriptionChange.findFirst({
                    where: { org_id: orgId, status: { in: OPEN_CHANGE_STATUSES } }
                });
                if (openChange) {
                    throw new PaymentValidationError(
                        "Un changement d’abonnement est déjà en cours. Terminez-le avant d’en démarrer un autre.",
                        "SUBSCRIPTION_CHANGE_IN_PROGRESS"
                    );
                }
                const subscription = await ensureSubscription(tx, organization);
                const change = await tx.subscriptionChange.create({
                    data: {
                        org_id: orgId,
                        subscription_id: subscription.subscription_id,
                        from_plan_id: organization.subscription_plan,
                        to_plan_id: plan.plan_id,
                        from_interval: organization.subscription_interval,
                        to_interval: normalizedInterval,
                        type: transition.type,
                        status: "AWAITING_PAYMENT",
                        effective_at: transition.effectiveAt,
                        quoted_amount: new Prisma.Decimal(localPrice),
                        quoted_currency: provider.currency,
                        reference_amount: new Prisma.Decimal(referencePrice),
                        reference_currency: plan.currency,
                        source_version: subscription.version
                    }
                });
                subscriptionChangeId = change.subscription_change_id;
            }
            return tx.payment.create({
                data: {
                    deposit_id: depositId,
                    org_id: orgId,
                    plan_id: plan.plan_id,
                    initiated_by_id: userId,
                    amount: new Prisma.Decimal(localPrice),
                    currency: provider.currency,
                    reference_amount: new Prisma.Decimal(referencePrice),
                    reference_currency: plan.currency,
                    country: provider.country,
                    provider: provider.provider,
                    phone_number: normalizedPhone,
                    billing_interval: normalizedInterval,
                    subscription_change_id: subscriptionChangeId
                },
                include: {
                    plan: true,
                    subscription_change: { include: { from_plan: true, to_plan: true } }
                }
            });
        });
    } catch (error) {
        if (error?.code === "P2002") {
            throw new PaymentValidationError(
                "Un changement d’abonnement est déjà en cours.",
                "SUBSCRIPTION_CHANGE_IN_PROGRESS"
            );
        }
        throw error;
    }

    const payload = {
        depositId,
        amount: String(localPrice),
        currency: provider.currency,
        payer: {
            type: "MMO",
            accountDetails: {
                phoneNumber: normalizedPhone,
                provider: provider.provider
            }
        },
        clientReferenceId: `ACCESSQ-${payment.payment_id}`,
        customerMessage: buildProviderCustomerMessage({
            planKey: normalizedPlan,
            billingInterval: normalizedInterval,
            transitionType: transition?.type
        }),
        metadata: [
            { organizationId: String(orgId), isPII: false },
            { plan: plan.title, isPII: false },
            { billingInterval: normalizedInterval, isPII: false },
            {
                paymentReason: buildPaymentReason({
                    planKey: normalizedPlan,
                    billingInterval: normalizedInterval,
                    transitionType: transition?.type
                }),
                isPII: false
            },
            { referencePrice: `${referencePrice} ${plan.currency}`, isPII: false }
        ]
    };

    try {
        const response = await pawaPay.initiateDeposit(payload);
        const accepted = ["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status);
        const rawFailure = extractPawaPayFailure(response);
        if (!accepted) {
            logger.warn("payment.pawapay_rejected", {
                payment_id: payment.payment_id,
                deposit_id: depositId,
                org_id: orgId,
                pawapay_failure_code: rawFailure.code,
                pawapay_failure_message: rawFailure.message
            });
        }
        const updated = await prisma.payment.update({
            where: { payment_id: payment.payment_id },
            data: accepted
                ? {
                    status: response?.status === "PROCESSING" ? "PROCESSING" : "PENDING",
                    provider_payload: response
                }
                : {
                    status: "FAILED",
                    failure_code: rawFailure.code || "REJECTED",
                    failure_message: rawFailure.message || rawFailure.code || "REJECTED",
                    provider_payload: response
                },
            include: {
                plan: true,
                subscription_change: { include: { from_plan: true, to_plan: true } }
            }
        });
        if (!accepted && payment.subscription_change_id) {
            await prisma.subscriptionChange.update({
                where: { subscription_change_id: payment.subscription_change_id },
                data: { status: "FAILED", reason: updated.failure_code }
            });
        }
        return serializePayment(updated);
    } catch (error) {
        const rawFailure = extractPawaPayFailure(error.responseData);
        logger.error("payment.initiation_uncertain", {
            payment_id: payment.payment_id,
            deposit_id: depositId,
            org_id: orgId,
            pawapay_failure_code: rawFailure.code,
            pawapay_failure_message: rawFailure.message,
            error
        });
        error.payment = serializePayment(payment);
        throw error;
    }
};

module.exports = {
    getPaymentQuote,
    initiatePayment
};
