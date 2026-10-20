// Validation des numéros, libellés et messages d’erreur des paiements, sérialisation.
const { PLAN_KEYS, BILLING_INTERVALS, PLAN_DETAILS } = require("../../config/subscription");

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

const buildPaymentReason = ({ planKey, billingInterval, transitionType } = {}) => {
    if (planKey === PLAN_KEYS.EVENT_PASS) return "Achat d’un Pass événement AccessQ";

    const planName = PLAN_DETAILS[planKey]?.name || planKey || "AccessQ";
    const intervalLabel = billingInterval === BILLING_INTERVALS.ANNUAL ? "annuel" : "mensuel";
    switch (transitionType) {
    case "RENEWAL":
        return `Renouvellement de l’abonnement ${planName} (${intervalLabel})`;
    case "UPGRADE":
        return `Passage à l’abonnement ${planName} (${intervalLabel})`;
    case "DOWNGRADE":
        return `Changement vers l’abonnement ${planName} (${intervalLabel})`;
    case "INTERVAL_CHANGE":
        return `Passage à l’abonnement ${planName} ${intervalLabel}`;
    default:
        return `Achat de l’abonnement ${planName} (${intervalLabel})`;
    }
};

const buildProviderCustomerMessage = ({ planKey, billingInterval, transitionType } = {}) => {
    if (planKey === PLAN_KEYS.EVENT_PASS) return "AccessQ Pass evenement";
    const planName = PLAN_DETAILS[planKey]?.name || planKey || "Plan";
    if (transitionType === "RENEWAL") return `Renouv AccessQ ${planName}`.slice(0, 22);
    if (transitionType === "UPGRADE") return `Passage AccessQ ${planName}`.slice(0, 22);
    const intervalLabel = billingInterval === BILLING_INTERVALS.ANNUAL ? "annuel" : "mensuel";
    return `AccessQ ${planName} ${intervalLabel}`.slice(0, 22);
};

const extractPawaPayFailure = (payload) => {
    const normalizedPayload = Array.isArray(payload) ? payload[0] : payload;
    const source = normalizedPayload?.failureReason
        || normalizedPayload?.errors?.[0]
        || normalizedPayload?.data?.failureReason
        || normalizedPayload?.error?.failureReason
        || normalizedPayload?.data?.error
        || normalizedPayload?.error
        || normalizedPayload
        || {};
    return {
        code: source.failureCode || source.code || normalizedPayload?.status || null,
        message: typeof source === "string"
            ? source
            : source.failureMessage || source.message || source.errorMessage || source.detail || null
    };
};

const publicPaymentFailureMessage = (payload) => {
    const failure = extractPawaPayFailure(payload);
    const searchable = `${failure.code || ""} ${failure.message || ""}`.toLowerCase();

    if (/(msisdn|phone|payer|subscriber).*(too long|longer|max(imum)? length)|too long.*(msisdn|phone|payer)/.test(searchable)) {
        return "Le numéro saisi est trop long pour ce pays.";
    }
    if (/(msisdn|phone|payer|subscriber).*(too short|shorter|min(imum)? length)|too short.*(msisdn|phone|payer)/.test(searchable)) {
        return "Le numéro saisi est trop court pour ce pays.";
    }
    if (/(invalid|incorrect|malformed).*(msisdn|phone|payer|subscriber)|(msisdn|phone|payer).*(invalid|incorrect|format)/.test(searchable)) {
        return "Le numéro saisi n’est pas valide pour ce pays.";
    }
    if (/payer.not.found|subscriber.not.found|unknown subscriber|number.*not found/.test(searchable)) {
        return "Ce numéro Mobile Money n’a pas été reconnu par l’opérateur.";
    }
    if (/insufficient|not.enough.funds|balance.*low/.test(searchable)) {
        return "Le solde du compte Mobile Money est insuffisant.";
    }
    if (/limit.*(reached|exceeded)|payer.limit|transaction.limit/.test(searchable)) {
        return "La limite de transaction de ce compte Mobile Money a été atteinte.";
    }
    if (/expired|timeout|timed.out/.test(searchable)) {
        return "La demande de paiement a expiré. Veuillez réessayer.";
    }
    if (/cancelled.by.(payer|customer|user)|user.cancelled|payer.cancelled/.test(searchable)) {
        return "Le paiement a été annulé sur le téléphone.";
    }
    if (/declined|not.approved|rejected|payment.refused/.test(searchable)) {
        return "Le paiement a été refusé. Vérifiez votre compte Mobile Money puis réessayez.";
    }
    if (/provider.*(unavailable|offline|not available)|temporarily.unavailable/.test(searchable)) {
        return "L’opérateur Mobile Money est temporairement indisponible. Veuillez réessayer plus tard.";
    }
    if (/unsupported.*(provider|operator)|provider.*not.supported/.test(searchable)) {
        return "Cet opérateur Mobile Money n’est pas pris en charge.";
    }
    if (/unsupported.*country|country.*not.supported|invalid.country/.test(searchable)) {
        return "Les paiements Mobile Money ne sont pas disponibles pour ce pays.";
    }
    if (/amount.*(too low|below|min)|minimum.*amount/.test(searchable)) {
        return "Le montant est inférieur au minimum accepté par l’opérateur.";
    }
    if (/amount.*(too high|above|max)|maximum.*amount/.test(searchable)) {
        return "Le montant dépasse le maximum accepté par l’opérateur.";
    }
    if (/currency.*(invalid|unsupported|not supported)/.test(searchable)) {
        return "La devise sélectionnée n’est pas acceptée par cet opérateur.";
    }
    return "Le paiement n’a pas pu être traité. Vérifiez les informations saisies puis réessayez.";
};

const serializePayment = (payment) => ({
    id: payment.payment_id,
    depositId: payment.deposit_id,
    plan: payment.plan?.title || null,
    billingInterval: payment.billing_interval,
    reason: buildPaymentReason({
        planKey: payment.plan?.title,
        billingInterval: payment.billing_interval,
        transitionType: payment.subscription_change?.type
    }),
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
    failureMessage: payment.failure_message
        ? publicPaymentFailureMessage({
            failureCode: payment.failure_code,
            failureMessage: payment.failure_message
        })
        : null,
    accessStartsAt: payment.access_starts_at,
    accessExpiresAt: payment.access_expires_at,
    createdAt: payment.created_at,
    completedAt: payment.completed_at,
    change: payment.subscription_change ? {
        id: payment.subscription_change.subscription_change_id,
        type: payment.subscription_change.type,
        status: payment.subscription_change.status,
        effectiveAt: payment.subscription_change.effective_at,
        fromPlan: payment.subscription_change.from_plan?.title || null,
        toPlan: payment.subscription_change.to_plan?.title || payment.plan?.title || null
    } : null
});

module.exports = {
    PaymentValidationError,
    normalizePhoneNumber,
    maskPhoneNumber,
    buildPaymentReason,
    buildProviderCustomerMessage,
    extractPawaPayFailure,
    publicPaymentFailureMessage,
    serializePayment
};
