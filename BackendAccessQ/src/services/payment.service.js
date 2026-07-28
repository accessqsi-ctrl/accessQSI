const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const pawaPay = require("./pawapay.service");
const logger = require("../utils/logger");
const { getPaymentConfig } = require("../config/payment");
const {
    PLAN_KEYS,
    PLAN_DETAILS,
    ensureDefaultPlans,
    getFixedPlanPrice,
    getPlanByKey,
    getPlanSummary,
    getTrialDurationDays
} = require("../config/subscription");

class PaymentValidationError extends Error {
    constructor(message, code = "PAYMENT_VALIDATION_ERROR") {
        super(message);
        this.name = "PaymentValidationError";
        this.code = code;
    }
}

const normalizePhoneNumber = (value, options = {}) => {
    const country = typeof options === "string" ? options : options.country;
    const prefix = typeof options === "object" ? String(options.prefix || "").replace(/\D/g, "") : "";
    const digits = String(value || "").replace(/\D/g, "");

    if (country === "COD" || prefix === "243") {
        let national = digits;
        if (national.startsWith("243")) national = national.slice(3);
        if (national.startsWith("0")) national = national.slice(1);
        if (!/^[1-9]\d{8}$/.test(national)) {
            throw new PaymentValidationError(
                "Utilisez un numéro congolais valide, par exemple 0991234567.",
                "INVALID_PHONE_NUMBER"
            );
        }
        return `243${national}`;
    }

    if (!prefix) {
        if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
            throw new PaymentValidationError(
                "Saisissez le numéro au format international avec l'indicatif du pays.",
                "INVALID_PHONE_NUMBER"
            );
        }
        return digits;
    }

    let national = digits;
    if (national.startsWith(prefix)) national = national.slice(prefix.length);
    if (national.startsWith("0")) national = national.slice(1);
    const international = `${prefix}${national}`;
    if (!/^[1-9]\d{7,14}$/.test(international)) {
        throw new PaymentValidationError(
            "Le numéro Mobile Money est invalide pour le pays sélectionné.",
            "INVALID_PHONE_NUMBER"
        );
    }
    return international;
};

const maskPhoneNumber = (phoneNumber) => {
    const value = String(phoneNumber || "");
    if (value.length <= 6) return value;
    return `${value.slice(0, 4)}••••${value.slice(-3)}`;
};

const serializePayment = (payment) => ({
    id: payment.payment_id,
    depositId: payment.deposit_id,
    plan: payment.plan?.title || null,
    amount: payment.amount?.toString?.() || String(payment.amount),
    currency: payment.currency,
    referenceAmount: payment.reference_amount == null
        ? null
        : payment.reference_amount?.toString?.() || String(payment.reference_amount),
    referenceCurrency: payment.reference_currency || null,
    country: payment.country,
    provider: payment.provider,
    phoneNumber: maskPhoneNumber(payment.phone_number),
    status: payment.status,
    providerTransactionId: payment.provider_transaction_id,
    failureCode: payment.failure_code,
    failureMessage: payment.failure_message,
    accessStartsAt: payment.access_starts_at,
    accessExpiresAt: payment.access_expires_at,
    createdAt: payment.created_at,
    completedAt: payment.completed_at
});

const getProviders = async () => {
    const paymentConfig = getPaymentConfig();
    const supportedCurrencies = Object.keys(PLAN_DETAILS.PRO.fixedPrices);
    if (paymentConfig.providerAllowlist.length > 0 && !process.env.PAWAPAY_API_TOKEN) {
        return paymentConfig.providerAllowlist.map((provider) => ({
            provider,
            displayName: provider.replace(/_/g, " "),
            country: paymentConfig.country || provider.split("_").at(-1),
            currency: PLAN_DETAILS.PRO.currency,
            price: PLAN_DETAILS.PRO.price
        }));
    }

    const configuration = await pawaPay.getActiveConfiguration();
    const providers = pawaPay.extractProviders(configuration);
    return providers.filter((provider) => (
        provider.supportsDeposit !== false
        && supportedCurrencies.includes(provider.currency)
        && (
            paymentConfig.providerAllowlist.length === 0
            || paymentConfig.providerAllowlist.includes(provider.provider)
        )
    )).map((provider) => ({
        ...provider,
        price: getFixedPlanPrice(PLAN_KEYS.PRO, provider.currency)
    }));
};

const getPlans = async () => {
    await ensureDefaultPlans(prisma);
    const plans = await prisma.plan.findMany({ orderBy: { cost: "asc" } });
    return plans.map((plan) => {
        const details = PLAN_DETAILS[plan.title] || {};
        return {
            id: plan.plan_id,
            key: plan.title,
            name: details.name || plan.title,
            price: plan.cost,
            currency: plan.currency,
            localPrices: details.fixedPrices || {},
            features: details.features || [],
            durationDays: plan.title === PLAN_KEYS.PRO ? getPaymentConfig().subscriptionDays : null
        };
    });
};

const getBillingOverview = async (orgId) => {
    const [organization, payments] = await Promise.all([
        prisma.organization.findUnique({
            where: { org_id: orgId },
            include: { plan: true }
        }),
        prisma.payment.findMany({
            where: { org_id: orgId },
            include: { plan: true },
            orderBy: { created_at: "desc" },
            take: 20
        })
    ]);
    if (!organization) {
        throw new PaymentValidationError("Organisation introuvable.", "ORGANIZATION_NOT_FOUND");
    }

    return {
        subscription: {
            ...getPlanSummary(organization),
            startedAt: organization.subscription_started_at,
            expiresAt: organization.subscription_expires_at
        },
        payments: payments.map(serializePayment)
    };
};

const startProTrial = async (orgId) => {
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
    if (getPlanSummary(organization).isPro) {
        throw new PaymentValidationError(
            "Votre organisation bénéficie déjà du plan Pro.",
            "PRO_ALREADY_ACTIVE"
        );
    }
    if (!proPlan) {
        throw new PaymentValidationError("Le plan Pro est indisponible.", "PRO_PLAN_NOT_FOUND");
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + getTrialDurationDays());

    const activation = await prisma.organization.updateMany({
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
            trial_started_at: now,
            trial_expires_at: expiresAt
        }
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

const findProvider = async (providerCode, countryCode) => {
    const normalized = String(providerCode || "").trim().toUpperCase();
    if (!normalized) {
        throw new PaymentValidationError("Choisissez un opérateur Mobile Money.", "PROVIDER_REQUIRED");
    }
    const providers = await getProviders();
    const normalizedCountry = String(countryCode || "").trim().toUpperCase();
    const provider = providers.find((item) => (
        item.provider === normalized
        && (!normalizedCountry || item.country === normalizedCountry)
    ));
    if (!provider) {
        throw new PaymentValidationError(
            "Cet opérateur n'est pas disponible pour votre compte pawaPay.",
            "PROVIDER_NOT_AVAILABLE"
        );
    }
    return provider;
};

const initiatePayment = async ({ orgId, userId, planKey, providerCode, countryCode, phoneNumber }) => {
    const paymentConfig = getPaymentConfig();
    const normalizedPlan = String(planKey || "").trim().toUpperCase();
    if (normalizedPlan !== PLAN_KEYS.PRO) {
        throw new PaymentValidationError("Seul le plan Pro peut être acheté.", "PLAN_NOT_PURCHASABLE");
    }

    const [organization, plan, provider] = await Promise.all([
        prisma.organization.findUnique({ where: { org_id: orgId } }),
        getPlanByKey(prisma, normalizedPlan),
        findProvider(providerCode, countryCode)
    ]);
    if (!organization || organization.deleted_at || !organization.is_active) {
        throw new PaymentValidationError("Organisation inactive ou introuvable.", "ORGANIZATION_NOT_FOUND");
    }
    if (!plan || plan.cost <= 0) {
        throw new PaymentValidationError("Le tarif du plan est invalide.", "INVALID_PLAN_PRICE");
    }
    const localPrice = getFixedPlanPrice(plan.title, provider.currency);
    if (localPrice === null) {
        throw new PaymentValidationError(
            "Aucun tarif local n'est configuré pour la devise de cet opérateur.",
            "LOCAL_PRICE_NOT_CONFIGURED"
        );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber, {
        country: provider.country,
        prefix: provider.prefix
    });
    const depositId = crypto.randomUUID();
    const payment = await prisma.payment.create({
        data: {
            deposit_id: depositId,
            org_id: orgId,
            plan_id: plan.plan_id,
            initiated_by_id: userId,
            amount: new Prisma.Decimal(localPrice),
            currency: provider.currency,
            reference_amount: new Prisma.Decimal(plan.cost),
            reference_currency: plan.currency,
            country: provider.country,
            provider: provider.provider,
            phone_number: normalizedPhone
        },
        include: { plan: true }
    });

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
        customerMessage: paymentConfig.customerMessage,
        metadata: [
            { organizationId: String(orgId), isPII: false },
            { plan: plan.title, isPII: false },
            { referencePrice: `${plan.cost} ${plan.currency}`, isPII: false }
        ]
    };

    try {
        const response = await pawaPay.initiateDeposit(payload);
        const accepted = ["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status);
        const updated = await prisma.payment.update({
            where: { payment_id: payment.payment_id },
            data: accepted
                ? {
                    status: response?.status === "PROCESSING" ? "PROCESSING" : "PENDING",
                    provider_payload: response
                }
                : {
                    status: "FAILED",
                    failure_code: response?.failureReason?.failureCode || response?.status || "REJECTED",
                    failure_message: response?.failureReason?.failureMessage || "La demande de paiement a été rejetée.",
                    provider_payload: response
                },
            include: { plan: true }
        });
        return serializePayment(updated);
    } catch (error) {
        logger.error("payment.initiation_uncertain", {
            payment_id: payment.payment_id,
            deposit_id: depositId,
            org_id: orgId,
            error
        });
        error.payment = serializePayment(payment);
        throw error;
    }
};

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

const reconcilePayment = async (depositId) => {
    const existing = await prisma.payment.findUnique({
        where: { deposit_id: depositId },
        include: { plan: true }
    });
    if (!existing) return null;
    if (existing.status === "COMPLETED") return serializePayment(existing);

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
        const paymentConfig = getPaymentConfig();
        const completed = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw(
                Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${existing.org_id} FOR UPDATE`
            );
            const current = await tx.payment.findUnique({
                where: { payment_id: existing.payment_id },
                include: { plan: true }
            });
            if (current.status === "COMPLETED") return current;

            const organization = await tx.organization.findUnique({
                where: { org_id: existing.org_id }
            });
            const now = new Date();
            const currentExpiry = organization.subscription_expires_at;
            const startsAt = currentExpiry && currentExpiry > now ? currentExpiry : now;
            const expiresAt = new Date(startsAt);
            expiresAt.setUTCDate(expiresAt.getUTCDate() + paymentConfig.subscriptionDays);

            await tx.organization.update({
                where: { org_id: existing.org_id },
                data: {
                    subscription_plan: existing.plan_id,
                    subscription_started_at: organization.subscription_started_at || now,
                    subscription_expires_at: expiresAt
                }
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
                include: { plan: true }
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
    const updated = await prisma.payment.update({
        where: { payment_id: existing.payment_id },
        data: {
            status: remote.status === "FAILED" ? "FAILED" : "PROCESSING",
            provider_transaction_id: remote.providerTransactionId || null,
            failure_code: remote.status === "FAILED" ? failure.failureCode || "FAILED" : null,
            failure_message: remote.status === "FAILED" ? failure.failureMessage || "Le paiement a échoué." : null,
            provider_payload: remote
        },
        include: { plan: true }
    });
    return serializePayment(updated);
};

module.exports = {
    PaymentValidationError,
    normalizePhoneNumber,
    serializePayment,
    getProviders,
    getPlans,
    getBillingOverview,
    startProTrial,
    initiatePayment,
    reconcilePayment
};
