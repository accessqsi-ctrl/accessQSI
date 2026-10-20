// Point d'entrée du module de paiement. L'implémentation est découpée par responsabilité dans ./payment/.
const {
    arePaymentsEnabled,
    classifyChange,
    getRemainingMonthlyUnits,
    getRemainingPeriodUnits,
    roundForProvider,
    calculatePaymentQuote,
    selectProviderConfiguration
} = require("./payment/policy");
const {
    PaymentValidationError,
    normalizePhoneNumber,
    buildPaymentReason,
    buildProviderCustomerMessage,
    extractPawaPayFailure,
    publicPaymentFailureMessage,
    serializePayment
} = require("./payment/format");
const { getProviders, getPlans } = require("./payment/catalog");
const {
    getBillingOverview,
    startProTrial,
    requestCancellation,
    cancelOpenChange,
    selectRetainedResources,
    applyDueSubscriptionChanges
} = require("./payment/subscription");
const { getPaymentQuote, initiatePayment } = require("./payment/checkout");
const { reconcilePayment, reconcileRefund, reconcilePendingTransactions } = require("./payment/reconciliation");

module.exports = {
    PaymentValidationError,
    arePaymentsEnabled,
    normalizePhoneNumber,
    buildPaymentReason,
    buildProviderCustomerMessage,
    extractPawaPayFailure,
    publicPaymentFailureMessage,
    serializePayment,
    getProviders,
    getPlans,
    getBillingOverview,
    getPaymentQuote,
    startProTrial,
    requestCancellation,
    cancelOpenChange,
    selectRetainedResources,
    initiatePayment,
    reconcilePayment,
    reconcileRefund,
    reconcilePendingTransactions,
    applyDueSubscriptionChanges,
    subscriptionPolicy: {
        classifyChange,
        getRemainingMonthlyUnits,
        getRemainingPeriodUnits,
        roundForProvider,
        calculatePaymentQuote,
        selectProviderConfiguration
    }
};
