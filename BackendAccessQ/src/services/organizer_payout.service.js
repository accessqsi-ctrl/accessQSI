// Reversements du solde des organisateurs et remboursements des achats de billets.
// L'organisateur demande, un super-admin valide (console d'administration), le backend exécute auprès de pawaPay
// puis vérifie le résultat. Le montant d'un reversement quitte le solde dès la demande et y revient en cas d'échec.
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const pawaPay = require("./pawapay.service");
const logger = require("../utils/logger");
const { getPaymentConfig } = require("../config/payment");
const { TICKET_CURRENCIES, getTicketingConfig } = require("../config/ticketing");
const { roundForProvider, selectProviderConfiguration } = require("./payment/policy");
const { normalizePhoneNumber, maskPhoneNumber, extractPawaPayFailure, publicPaymentFailureMessage } = require("./payment/format");
const { amountsMatch } = require("./payment/reconciliation");
const { RegistrationError, uuidPattern } = require("./registration.service");

const OPEN_PAYOUT_STATUSES = ["REQUESTED", "APPROVED", "SUBMITTING", "PROCESSING"];
const PROVIDER_CACHE_MS = 60_000;
// Une soumission interrompue (arrêt du serveur pendant l'appel) est revérifiée après ce délai.
const STALE_SUBMISSION_MS = 5 * 60_000;

const assertPassword = async (userId, password) => {
    const user = await prisma.userQ.findUnique({ where: { user_id: userId }, select: { password_hash: true } });
    const valid = Boolean(user?.password_hash && typeof password === "string" && password && await bcrypt.compare(password, user.password_hash));
    if (!valid) throw new RegistrationError("Mot de passe incorrect.", "INVALID_PASSWORD", 403);
};

let providerCache = { at: 0, providers: null };
const payoutProviders = async (now = Date.now()) => {
    if (providerCache.providers && now - providerCache.at < PROVIDER_CACHE_MS) return providerCache.providers;
    const { providerAllowlist } = getPaymentConfig();
    const providers = pawaPay.extractProviders(await pawaPay.getActiveConfiguration("PAYOUT"), "PAYOUT").filter(provider => (
        provider.supportsPayout !== false
        && TICKET_CURRENCIES.includes(provider.currency)
        && (providerAllowlist.length === 0 || providerAllowlist.includes(provider.provider))
    ));
    providerCache = { at: now, providers };
    return providers;
};

const resetProviderCache = () => { providerCache = { at: 0, providers: null }; };

const listPayoutProviders = async () => (await payoutProviders()).map(provider => ({
    provider: provider.provider,
    displayName: provider.displayName,
    country: provider.country,
    countryDisplayName: provider.countryDisplayName,
    prefix: provider.prefix,
    currency: provider.currency
}));

// Nom affiché de l'opérateur (« Vodacom M-Pesa ») ; le code pawaPay reste disponible dans `provider`.
const providerNameOf = (names, code) => names?.get(code) || code;

// Noms des opérateurs d'après la configuration pawaPay en cache. Sans réponse de pawaPay, on garde les codes :
// l'affichage du solde ne doit jamais échouer pour un libellé.
const providerNames = async () => {
    try {
        return new Map((await payoutProviders()).map(provider => [provider.provider, provider.displayName || provider.provider]));
    } catch (error) {
        logger.warn("payout.provider_names_unavailable", { pawapay_failure_code: extractPawaPayFailure(error.responseData).code });
        return new Map();
    }
};

const serializeAccount = (account, names) => ({
    currency: account.currency,
    country: account.country,
    provider: account.provider,
    providerName: providerNameOf(names, account.provider),
    phoneNumber: maskPhoneNumber(account.phone_number),
    updatedAt: account.updated_at
});

const serializePayout = (payout, names) => ({
    id: payout.payout_id,
    status: payout.status,
    amount: String(payout.amount),
    currency: payout.currency,
    provider: payout.provider,
    providerName: providerNameOf(names, payout.provider),
    phoneNumber: maskPhoneNumber(payout.phone_number),
    failureMessage: payout.status === "REJECTED"
        ? payout.failure_message || "Demande refusée par AccessQ."
        : payout.failure_message ? publicPaymentFailureMessage({ failureCode: payout.failure_code, failureMessage: payout.failure_message }) : null,
    createdAt: payout.created_at,
    reviewedAt: payout.reviewed_at,
    completedAt: payout.completed_at
});

const availableBalance = async (tx, orgId, currency) => {
    const sum = await tx.organizerLedgerEntry.aggregate({ where: { org_id: orgId, currency }, _sum: { amount: true } });
    return new Prisma.Decimal(sum._sum.amount || 0);
};

const getOverview = async orgId => {
    const [accounts, payouts] = await Promise.all([
        prisma.organizerPayoutAccount.findMany({ where: { org_id: orgId }, orderBy: { currency: "asc" } }),
        prisma.organizerPayout.findMany({ where: { org_id: orgId }, orderBy: { created_at: "desc" }, take: 20 })
    ]);
    const names = accounts.length || payouts.length ? await providerNames() : null;
    return { accounts: accounts.map(account => serializeAccount(account, names)), payouts: payouts.map(payout => serializePayout(payout, names)) };
};

const normalizeCurrency = value => {
    const currency = String(value || "").trim().toUpperCase();
    if (!TICKET_CURRENCIES.includes(currency)) throw new RegistrationError("Devise invalide.", "INVALID_CURRENCY", 422);
    return currency;
};

const setAccount = async (orgId, userId, input = {}) => {
    const currency = normalizeCurrency(input.currency);
    await assertPassword(userId, input.password);
    const provider = selectProviderConfiguration(
        (await payoutProviders()).filter(item => item.currency === currency),
        input.provider,
        input.country,
        currency
    );
    const phoneNumber = normalizePhoneNumber(input.phoneNumber, { country: provider.country, prefix: provider.prefix });
    const data = { country: provider.country, provider: provider.provider, phone_number: phoneNumber, updated_by_id: userId };
    const account = await prisma.organizerPayoutAccount.upsert({
        where: { org_id_currency: { org_id: orgId, currency } },
        create: { org_id: orgId, currency, ...data },
        update: data
    });
    logger.info("payout.account_updated", { org_id: orgId, user_id: userId, currency, provider: provider.provider });
    return serializeAccount(account, new Map([[provider.provider, provider.displayName || provider.provider]]));
};

const requestPayout = async (orgId, userId, input = {}) => {
    const currency = normalizeCurrency(input.currency);
    await assertPassword(userId, input.password);
    const account = await prisma.organizerPayoutAccount.findUnique({ where: { org_id_currency: { org_id: orgId, currency } } });
    if (!account) throw new RegistrationError("Enregistrez d’abord un compte Mobile Money pour cette devise.", "PAYOUT_ACCOUNT_REQUIRED", 409);
    const provider = (await payoutProviders()).find(item => item.provider === account.provider && item.country === account.country && item.currency === currency);
    if (!provider) throw new RegistrationError("Cet opérateur n’accepte plus les reversements. Modifiez votre compte de réception.", "PROVIDER_NOT_AVAILABLE", 409);
    const requested = input.amount === undefined || input.amount === null || String(input.amount).trim() === ""
        ? null
        : String(input.amount).trim().replace(",", ".");
    if (requested !== null && !/^\d{1,12}(\.\d{1,2})?$/.test(requested)) throw new RegistrationError("Montant invalide.", "INVALID_AMOUNT", 422);

    const run = () => prisma.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`);
        const open = await tx.organizerPayout.findFirst({ where: { org_id: orgId, currency, status: { in: OPEN_PAYOUT_STATUSES } } });
        if (open) throw new RegistrationError("Un reversement est déjà en cours pour cette devise.", "PAYOUT_IN_PROGRESS", 409);
        const balance = await availableBalance(tx, orgId, currency);
        const amount = requested === null ? balance : new Prisma.Decimal(requested);
        if (amount.lte(0)) throw new RegistrationError("Aucun montant disponible à reverser.", "INSUFFICIENT_BALANCE", 409);
        if (amount.gt(balance)) throw new RegistrationError("Le montant dépasse votre solde disponible.", "INSUFFICIENT_BALANCE", 409);
        if (roundForProvider(amount.toString(), provider.decimals) !== Number(amount.toString())) {
            throw new RegistrationError("Ce montant n’est pas payable avec l’opérateur choisi (décimales).", "INVALID_AMOUNT", 422);
        }
        const payout = await tx.organizerPayout.create({ data: {
            provider_payout_id: crypto.randomUUID(),
            org_id: orgId,
            amount,
            currency,
            country: account.country,
            provider: account.provider,
            phone_number: account.phone_number,
            requested_by_id: userId
        } });
        await tx.organizerLedgerEntry.create({ data: { org_id: orgId, type: "PAYOUT", amount: amount.neg(), currency, payout_id: payout.payout_id } });
        return payout;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    for (let attempt = 1; ; attempt += 1) {
        try {
            const payout = await run();
            logger.info("payout.requested", { org_id: orgId, user_id: userId, payout_id: payout.payout_id, currency });
            return serializePayout(payout, new Map([[provider.provider, provider.displayName || provider.provider]]));
        } catch (error) {
            if (error?.code !== "P2034" || attempt === 3) throw error;
        }
    }
};

// Remet le montant au solde. Idempotent grâce à l'unicité (payout_id, type).
// Un reversement de la plateforme (sans organisation) n'a pas d'écriture : son échec suffit à le sortir du calcul du solde.
const reverse = (tx, payout) => !payout.org_id ? null : tx.organizerLedgerEntry.upsert({
    where: { payout_id_type: { payout_id: payout.payout_id, type: "PAYOUT_REVERSAL" } },
    create: { org_id: payout.org_id, type: "PAYOUT_REVERSAL", amount: payout.amount, currency: payout.currency, payout_id: payout.payout_id },
    update: {}
});

const cancelPayout = async (orgId, payoutId) => {
    if (!uuidPattern.test(String(payoutId || ""))) throw new RegistrationError("Reversement introuvable.", "PAYOUT_NOT_FOUND", 404);
    return prisma.$transaction(async tx => {
        const claimed = await tx.organizerPayout.updateMany({ where: { payout_id: payoutId, org_id: orgId, status: "REQUESTED" }, data: { status: "CANCELED" } });
        if (claimed.count !== 1) throw new RegistrationError("Ce reversement ne peut plus être annulé.", "PAYOUT_NOT_CANCELABLE", 409);
        const payout = await tx.organizerPayout.findUnique({ where: { payout_id: payoutId } });
        await reverse(tx, payout);
        return serializePayout(payout);
    });
};

const unwrap = response => response?.status === "FOUND" && response.data ? response.data : null;

const failPayout = (payout, failure, payload, fromStatuses = ["SUBMITTING", "PROCESSING"]) => prisma.$transaction(async tx => {
    const claimed = await tx.organizerPayout.updateMany({
        where: { payout_id: payout.payout_id, status: { in: fromStatuses } },
        data: { status: "FAILED", failure_code: failure.code || "FAILED", failure_message: failure.message || failure.code || "FAILED", provider_payload: payload ?? undefined }
    });
    if (claimed.count === 1) await reverse(tx, payout);
    logger.warn("payout.failed", { payout_id: payout.payout_id, org_id: payout.org_id, pawapay_failure_code: failure.code });
});

const applyRemotePayout = async (payout, remote) => {
    if (
        (remote.amount && !amountsMatch(payout.amount, remote.amount))
        || (remote.currency && remote.currency !== payout.currency)
        || (remote.recipient?.accountDetails?.phoneNumber && remote.recipient.accountDetails.phoneNumber !== payout.phone_number)
    ) {
        // L'argent a pu partir : on ne recrédite pas le solde, l'écart est remonté pour analyse.
        logger.error("payout.reconciliation_mismatch", { payout_id: payout.payout_id, org_id: payout.org_id });
        return;
    }
    if (remote.status === "COMPLETED") {
        await prisma.organizerPayout.updateMany({
            where: { payout_id: payout.payout_id, status: { in: ["SUBMITTING", "PROCESSING"] } },
            data: { status: "COMPLETED", completed_at: new Date(), provider_transaction_id: remote.providerTransactionId || null, provider_payload: remote, failure_code: null, failure_message: null }
        });
        logger.info("payout.completed", { payout_id: payout.payout_id, org_id: payout.org_id });
    } else if (remote.status === "FAILED") {
        const reason = remote.failureReason || {};
        await failPayout(payout, { code: reason.failureCode, message: reason.failureMessage }, remote);
    } else {
        await prisma.organizerPayout.updateMany({ where: { payout_id: payout.payout_id, status: "SUBMITTING" }, data: { status: "PROCESSING", provider_payload: remote } });
    }
};

// Opérateur d'un reversement saisi par un super-admin : actif en reversement pour ce pays et cette devise, décimales acceptées.
const manualProviderFailure = async (payout, providerCode) => {
    const provider = (await payoutProviders()).find(item => item.provider === providerCode && item.currency === payout.currency);
    const amount = new Prisma.Decimal(payout.amount).toString();
    if (!provider) return { code: "PROVIDER_NOT_AVAILABLE", message: `${providerCode} n’accepte pas les reversements en ${payout.currency}.` };
    if (provider.country && provider.country !== payout.country) return { code: "COUNTRY_MISMATCH", message: `${providerCode} opère en ${provider.country}, pas ${payout.country}.` };
    if (roundForProvider(amount, provider.decimals) !== Number(amount)) return { code: "INVALID_AMOUNT", message: `${providerCode} n’accepte pas ce nombre de décimales.` };
    return null;
};

// Opérateur choisi par le super-admin : envoyé tel quel (pas de détection, un numéro porté serait mal identifié), après contrôle.
const checkManualProvider = async payout => {
    const failure = await manualProviderFailure(payout, payout.provider);
    if (!failure) return payout;
    await failPayout(payout, failure, null, ["APPROVED"]);
    return null;
};

// Destinataire saisi sans opérateur (reversements créés avant le choix de l'opérateur) : l'opérateur est demandé à pawaPay,
// puis contrôlé. Une erreur réseau laisse le reversement « validé » pour le prochain passage.
const resolveManualRecipient = async payout => {
    let prediction;
    try {
        prediction = await pawaPay.predictProvider(payout.phone_number);
    } catch (error) {
        if (!(error?.status >= 400 && error.status < 500)) throw error;
        await failPayout(payout, { code: "INVALID_PHONE_NUMBER", message: "Numéro refusé par pawaPay." }, error.responseData, ["APPROVED"]);
        return null;
    }
    let failure = null;
    if (!prediction?.provider) failure = { code: "PROVIDER_NOT_DETECTED", message: "Aucun opérateur Mobile Money trouvé pour ce numéro." };
    else if (prediction.country && prediction.country !== payout.country) failure = { code: "COUNTRY_MISMATCH", message: `Ce numéro relève du pays ${prediction.country}, pas ${payout.country}.` };
    else failure = await manualProviderFailure(payout, prediction.provider);
    if (failure) {
        await failPayout(payout, failure, prediction, ["APPROVED"]);
        return null;
    }
    const phoneNumber = prediction.phoneNumber || payout.phone_number;
    const updated = await prisma.organizerPayout.updateMany({
        where: { payout_id: payout.payout_id, status: "APPROVED", provider: null },
        data: { provider: prediction.provider, phone_number: phoneNumber }
    });
    if (updated.count !== 1) return null;
    logger.info("payout.provider_detected", { payout_id: payout.payout_id, provider: prediction.provider });
    return { ...payout, provider: prediction.provider, phone_number: phoneNumber };
};

const submitPayout = async initial => {
    const payout = !initial.manual_recipient ? initial
        : initial.provider ? await checkManualProvider(initial)
            : await resolveManualRecipient(initial);
    if (!payout) return;
    const claimed = await prisma.organizerPayout.updateMany({ where: { payout_id: payout.payout_id, status: "APPROVED" }, data: { status: "SUBMITTING", submitted_at: new Date() } });
    if (claimed.count !== 1) return;
    try {
        const response = await pawaPay.initiatePayout({
            payoutId: payout.provider_payout_id,
            amount: new Prisma.Decimal(payout.amount).toString(),
            currency: payout.currency,
            recipient: { type: "MMO", accountDetails: { phoneNumber: payout.phone_number, provider: payout.provider } },
            clientReferenceId: `ACCESSQ-PAYOUT-${payout.payout_id.slice(0, 8)}`,
            customerMessage: "AccessQ reversement",
            metadata: [
                payout.org_id ? { organizationId: String(payout.org_id), isPII: false } : { source: "PLATFORM", isPII: false },
                { payoutId: payout.payout_id, isPII: false }
            ]
        });
        if (["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status)) {
            await prisma.organizerPayout.update({ where: { payout_id: payout.payout_id }, data: { status: "PROCESSING", provider_payload: response } });
            logger.info("payout.submitted", { payout_id: payout.payout_id, org_id: payout.org_id });
        } else {
            await failPayout(payout, extractPawaPayFailure(response), response);
        }
    } catch (error) {
        // Issue incertaine : on revient à « validé ». Le même identifiant est renvoyé, pawaPay ignore un doublon.
        await prisma.organizerPayout.updateMany({ where: { payout_id: payout.payout_id, status: "SUBMITTING" }, data: { status: "APPROVED" } });
        logger.warn("payout.submission_uncertain", { payout_id: payout.payout_id, org_id: payout.org_id, status: error.status, error });
    }
};

const reconcilePayout = async (providerPayoutId, now = new Date()) => {
    const payout = await prisma.organizerPayout.findUnique({ where: { provider_payout_id: providerPayoutId } });
    if (!payout) return null;
    if (!["SUBMITTING", "PROCESSING"].includes(payout.status)) return payout;
    const response = await pawaPay.checkPayout(providerPayoutId);
    const remote = unwrap(response);
    if (remote) await applyRemotePayout(payout, remote);
    else if (response?.status === "NOT_FOUND" && payout.status === "SUBMITTING" && now - (payout.submitted_at || payout.updated_at) > STALE_SUBMISSION_MS) {
        await prisma.organizerPayout.updateMany({ where: { payout_id: payout.payout_id, status: "SUBMITTING" }, data: { status: "APPROVED" } });
    }
    return prisma.organizerPayout.findUnique({ where: { payout_id: payout.payout_id } });
};

// ——— Remboursements au payeur d'origine ———

const submitRefund = async refund => {
    const claimed = await prisma.ticketRefund.updateMany({ where: { ticket_refund_id: refund.ticket_refund_id, status: "PENDING", submitted_at: null }, data: { submitted_at: new Date() } });
    if (claimed.count !== 1) return;
    const payment = refund.ticket_payment;
    try {
        const response = await pawaPay.initiateRefund({
            refundId: refund.provider_refund_id,
            depositId: payment.deposit_id,
            amount: new Prisma.Decimal(payment.amount).toString(),
            currency: payment.currency
        });
        if (["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status)) {
            await prisma.ticketRefund.update({ where: { ticket_refund_id: refund.ticket_refund_id }, data: { status: "PROCESSING", provider_payload: response } });
        } else {
            await failRefund(refund, extractPawaPayFailure(response), response);
        }
    } catch (error) {
        await prisma.ticketRefund.updateMany({ where: { ticket_refund_id: refund.ticket_refund_id, status: "PENDING" }, data: { submitted_at: null } });
        logger.warn("ticket_refund.submission_uncertain", { ticket_refund_id: refund.ticket_refund_id, status: error.status, error });
    }
};

// Le paiement revient « à vérifier » : un super-admin peut relancer un remboursement.
const failRefund = (refund, failure, payload) => prisma.$transaction(async tx => {
    const claimed = await tx.ticketRefund.updateMany({
        where: { ticket_refund_id: refund.ticket_refund_id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "FAILED", failure_code: failure.code || "FAILED", failure_message: failure.message || failure.code || "FAILED", provider_payload: payload ?? undefined }
    });
    if (claimed.count === 1) await tx.ticketPayment.update({ where: { ticket_payment_id: refund.ticket_payment_id }, data: { status: "REVIEW_REQUIRED" } });
    logger.warn("ticket_refund.failed", { ticket_refund_id: refund.ticket_refund_id, pawapay_failure_code: failure.code });
});

const reconcileTicketRefund = async (providerRefundId, now = new Date()) => {
    const refund = await prisma.ticketRefund.findUnique({ where: { provider_refund_id: providerRefundId }, include: { ticket_payment: true } });
    if (!refund) return null;
    if (["COMPLETED", "FAILED"].includes(refund.status) || !refund.submitted_at) return refund;
    const response = await pawaPay.checkRefund(providerRefundId);
    const remote = unwrap(response);
    if (!remote) {
        if (response?.status === "NOT_FOUND" && refund.status === "PENDING" && now - refund.submitted_at > STALE_SUBMISSION_MS) {
            await prisma.ticketRefund.updateMany({ where: { ticket_refund_id: refund.ticket_refund_id, status: "PENDING" }, data: { submitted_at: null } });
        }
    } else if (remote.status === "COMPLETED") {
        await prisma.$transaction(async tx => {
            const claimed = await tx.ticketRefund.updateMany({
                where: { ticket_refund_id: refund.ticket_refund_id, status: { in: ["PENDING", "PROCESSING"] } },
                data: { status: "COMPLETED", completed_at: new Date(), provider_transaction_id: remote.providerTransactionId || null, provider_payload: remote }
            });
            if (claimed.count === 1) await tx.ticketPayment.update({ where: { ticket_payment_id: refund.ticket_payment_id }, data: { status: "REFUNDED" } });
        });
        logger.info("ticket_refund.completed", { ticket_refund_id: refund.ticket_refund_id });
    } else if (remote.status === "FAILED") {
        const reason = remote.failureReason || {};
        await failRefund(refund, { code: reason.failureCode, message: reason.failureMessage }, remote);
    } else if (refund.status === "PENDING") {
        await prisma.ticketRefund.update({ where: { ticket_refund_id: refund.ticket_refund_id }, data: { status: "PROCESSING", provider_payload: remote } });
    }
    return prisma.ticketRefund.findUnique({ where: { ticket_refund_id: refund.ticket_refund_id } });
};

const isTicketRefund = async refundId => (
    uuidPattern.test(String(refundId || "")) && Boolean(await prisma.ticketRefund.findUnique({ where: { provider_refund_id: String(refundId) }, select: { ticket_refund_id: true } }))
);

// Passe périodique : envoie ce qui a été validé dans la console et vérifie ce qui est en cours.
const processPending = async (now = new Date()) => {
    if (!getTicketingConfig().enabled) return { payouts: 0, refunds: 0 };
    const staleBefore = new Date(now.getTime() - STALE_SUBMISSION_MS);
    const [approved, inFlight, refundsToSend, refundsInFlight] = await Promise.all([
        prisma.organizerPayout.findMany({ where: { status: "APPROVED" }, orderBy: { reviewed_at: "asc" }, take: 20 }),
        prisma.organizerPayout.findMany({ where: { OR: [{ status: "PROCESSING" }, { status: "SUBMITTING", submitted_at: { lte: staleBefore } }] }, orderBy: { updated_at: "asc" }, take: 50 }),
        prisma.ticketRefund.findMany({ where: { status: "PENDING", submitted_at: null }, include: { ticket_payment: true }, orderBy: { created_at: "asc" }, take: 20 }),
        prisma.ticketRefund.findMany({ where: { OR: [{ status: "PROCESSING" }, { status: "PENDING", submitted_at: { lte: staleBefore } }] }, select: { provider_refund_id: true }, take: 50 })
    ]);
    const attempt = async (label, id, task) => {
        try { await task(); }
        catch (error) { logger.warn(`${label}.background_failed`, { id, pawapay_failure_code: extractPawaPayFailure(error.responseData).code, error }); }
    };
    for (const payout of approved) await attempt("payout", payout.payout_id, () => submitPayout(payout));
    for (const payout of inFlight) await attempt("payout", payout.payout_id, () => reconcilePayout(payout.provider_payout_id, now));
    for (const refund of refundsToSend) await attempt("ticket_refund", refund.ticket_refund_id, () => submitRefund(refund));
    for (const refund of refundsInFlight) await attempt("ticket_refund", refund.provider_refund_id, () => reconcileTicketRefund(refund.provider_refund_id, now));
    return { payouts: approved.length + inFlight.length, refunds: refundsToSend.length + refundsInFlight.length };
};

module.exports = {
    cancelPayout,
    getOverview,
    isTicketRefund,
    listPayoutProviders,
    processPending,
    reconcilePayout,
    reconcileTicketRefund,
    requestPayout,
    resetProviderCache,
    setAccount
};
