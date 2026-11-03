const ticketPayments = require("../services/ticket_payment.service");
const payouts = require("../services/organizer_payout.service");
const { PaymentValidationError, extractPawaPayFailure, publicPaymentFailureMessage } = require("../services/payment/format");
const { PawaPayConfigurationError, PawaPayRequestError } = require("../services/pawapay.service");
const logger = require("../utils/logger");

const handleError = (req, res, error, operation) => {
    const meta = { operation, request_id: req.requestId, attendee_id: req.attendee?.attendee_id, org_id: req.user?.org_id };
    if (error instanceof PaymentValidationError) {
        logger.warn("ticket_payment.request_rejected", { ...meta, code: error.code, reason: error.message });
        return res.status(422).json({ success: false, code: error.code, message: error.message, requestId: req.requestId });
    }
    if (error instanceof PawaPayConfigurationError || error instanceof PawaPayRequestError) {
        const failure = extractPawaPayFailure(error.responseData);
        logger.warn("ticket_payment.pawapay_unavailable", { ...meta, status: error.status, pawapay_failure_code: failure.code });
        return res.status(503).json({
            success: false,
            code: error.code,
            message: failure.code || failure.message ? publicPaymentFailureMessage(error.responseData) : "Le service Mobile Money est temporairement indisponible.",
            requestId: req.requestId
        });
    }
    const status = error.statusCode || 500;
    if (status >= 500) logger.error("ticket_payment.request_failed", { ...meta, status, error });
    else logger.warn("ticket_payment.request_rejected", { ...meta, status, code: error.code, reason: error.message });
    return res.status(status).json({
        success: false,
        code: error.statusCode ? error.code : "TICKET_PAYMENT_ERROR",
        message: error.statusCode ? error.message : "Erreur serveur",
        requestId: req.requestId
    });
};

exports.providers = async (req, res) => {
    try { return res.json({ success: true, providers: await ticketPayments.listOfferProviders(req.params.slug, req.params.offerId) }); }
    catch (error) { return handleError(req, res, error, "list_ticket_providers"); }
};

exports.checkout = async (req, res) => {
    try {
        const { payment, replayed } = await ticketPayments.initiate(req.params.slug, req.body || {}, req.get("idempotency-key"), req.attendee);
        const failed = payment.status === "FAILED";
        const body = ticketPayments.serializeTicketPayment(payment);
        return res.status(failed ? 422 : replayed ? 200 : 202).json({ success: !failed, replayed, message: failed ? body.failureMessage : undefined, payment: body });
    } catch (error) { return handleError(req, res, error, "ticket_checkout"); }
};

exports.status = async (req, res) => {
    try { return res.json({ success: true, payment: ticketPayments.serializeTicketPayment(await ticketPayments.getForAttendee(req.attendee.attendee_id, req.params.id)) }); }
    catch (error) { return handleError(req, res, error, "ticket_payment_status"); }
};

exports.payouts = async (req, res) => {
    try { return res.json({ success: true, ...(await payouts.getOverview(req.user.org_id)) }); }
    catch (error) { return handleError(req, res, error, "list_payouts"); }
};

exports.payoutProviders = async (req, res) => {
    try { return res.json({ success: true, providers: await payouts.listPayoutProviders() }); }
    catch (error) { return handleError(req, res, error, "list_payout_providers"); }
};

exports.setPayoutAccount = async (req, res) => {
    try { return res.json({ success: true, message: "Compte de réception enregistré.", account: await payouts.setAccount(req.user.org_id, req.user.user_id, req.body || {}) }); }
    catch (error) { return handleError(req, res, error, "set_payout_account"); }
};

exports.requestPayout = async (req, res) => {
    try { return res.status(201).json({ success: true, message: "Demande envoyée. Elle sera validée par AccessQ avant l’envoi.", payout: await payouts.requestPayout(req.user.org_id, req.user.user_id, req.body || {}) }); }
    catch (error) { return handleError(req, res, error, "request_payout"); }
};

exports.cancelPayout = async (req, res) => {
    try { return res.json({ success: true, message: "Demande annulée. Le montant est revenu sur votre solde.", payout: await payouts.cancelPayout(req.user.org_id, req.params.payoutId) }); }
    catch (error) { return handleError(req, res, error, "cancel_payout"); }
};

// Callbacks pawaPay : le statut est toujours revérifié auprès de pawaPay.
const verifiedCallback = (reconcile, label) => async (req, res, id) => {
    try {
        await reconcile(id);
        return res.json({ success: true });
    } catch (error) {
        logger.warn(`${label}.callback_failed`, { id, status: error.status, error });
        return res.status(error instanceof PawaPayRequestError ? 503 : 400).json({ success: false, message: "Callback non vérifiable." });
    }
};
exports.handleRefundCallback = verifiedCallback(payouts.reconcileTicketRefund, "ticket_refund");
const handlePayoutCallback = verifiedCallback(payouts.reconcilePayout, "payout");

exports.payoutCallback = async (req, res) => {
    const payoutId = req.body?.payoutId;
    if (!payoutId) return res.status(400).json({ success: false, message: "payoutId manquant." });
    return handlePayoutCallback(req, res, payoutId);
};

exports.balance = async (req, res) => {
    try { return res.json({ success: true, ...(await ticketPayments.organizationBalance(req.user.org_id)) }); }
    catch (error) { return handleError(req, res, error, "organizer_balance"); }
};

// Appelé par le callback pawaPay partagé : le dépôt est toujours revérifié auprès de pawaPay.
exports.handleCallback = async (req, res, depositId) => {
    try {
        await ticketPayments.reconcile(depositId);
        return res.json({ success: true });
    } catch (error) {
        if (error instanceof PawaPayRequestError) {
            logger.warn("ticket_payment.callback_pawapay_failed", { deposit_id: depositId, status: error.status });
            return res.status(503).json({ success: false, message: "Vérification temporairement indisponible." });
        }
        logger.error("ticket_payment.callback_failed", { deposit_id: depositId, error });
        return res.status(400).json({ success: false, message: "Callback non vérifiable." });
    }
};
