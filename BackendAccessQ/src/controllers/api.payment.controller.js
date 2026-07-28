const paymentService = require("../services/payment.service");
const {
    PawaPayConfigurationError,
    PawaPayRequestError
} = require("../services/pawapay.service");
const logger = require("../utils/logger");

const handleError = (res, error) => {
    if (error instanceof paymentService.PaymentValidationError) {
        return res.status(400).json({ success: false, code: error.code, message: error.message });
    }
    if (error instanceof PawaPayConfigurationError) {
        return res.status(503).json({ success: false, code: error.code, message: error.message });
    }
    if (error instanceof PawaPayRequestError) {
        return res.status(502).json({
            success: false,
            code: error.code,
            message: "Le service Mobile Money est temporairement indisponible.",
            payment: error.payment || null
        });
    }
    logger.error("payment.unhandled_error", { error });
    return res.status(500).json({ success: false, message: "Erreur lors du traitement du paiement." });
};

exports.getPlans = async (req, res) => {
    try {
        return res.json({ success: true, plans: await paymentService.getPlans() });
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getProviders = async (req, res) => {
    try {
        return res.json({ success: true, providers: await paymentService.getProviders() });
    } catch (error) {
        return handleError(res, error);
    }
};

exports.getOverview = async (req, res) => {
    try {
        const billing = await paymentService.getBillingOverview(req.user.org_id);
        return res.json({ success: true, ...billing });
    } catch (error) {
        return handleError(res, error);
    }
};

exports.startTrial = async (req, res) => {
    try {
        const subscription = await paymentService.startProTrial(req.user.org_id);
        return res.status(201).json({
            success: true,
            message: `Votre essai Pro de ${subscription.trialDurationDays} jours est actif.`,
            subscription
        });
    } catch (error) {
        return handleError(res, error);
    }
};

exports.initiate = async (req, res) => {
    try {
        const payment = await paymentService.initiatePayment({
            orgId: req.user.org_id,
            userId: req.user.user_id,
            planKey: req.body.plan,
            providerCode: req.body.provider,
            countryCode: req.body.country,
            phoneNumber: req.body.phoneNumber
        });
        return res.status(payment.status === "FAILED" ? 422 : 202).json({
            success: payment.status !== "FAILED",
            payment
        });
    } catch (error) {
        return handleError(res, error);
    }
};

exports.refreshStatus = async (req, res) => {
    try {
        const overview = await paymentService.getBillingOverview(req.user.org_id);
        const owned = overview.payments.find((payment) => payment.depositId === req.params.depositId);
        if (!owned) {
            return res.status(404).json({ success: false, message: "Paiement introuvable." });
        }
        const payment = await paymentService.reconcilePayment(req.params.depositId);
        return res.json({ success: true, payment });
    } catch (error) {
        return handleError(res, error);
    }
};

exports.callback = async (req, res) => {
    const depositId = req.body?.depositId;
    if (!depositId) {
        return res.status(400).json({ success: false, message: "depositId manquant." });
    }
    try {
        const payment = await paymentService.reconcilePayment(depositId);
        if (!payment) {
            logger.warn("payment.callback_unknown", { deposit_id: depositId });
            return res.status(202).json({ success: true, ignored: true });
        }
        return res.json({ success: true });
    } catch (error) {
        if (error instanceof PawaPayRequestError) {
            return res.status(503).json({ success: false, message: "Vérification temporairement indisponible." });
        }
        logger.error("payment.callback_failed", { deposit_id: depositId, error });
        return res.status(400).json({ success: false, message: "Callback non vérifiable." });
    }
};
