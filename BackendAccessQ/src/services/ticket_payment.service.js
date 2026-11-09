// Achat d'un billet payant : réservation de la place, dépôt pawaPay, puis émission du billet dans la box
// uniquement après confirmation du dépôt directement auprès de pawaPay. Un callback seul n'émet jamais de billet.
const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const pawaPay = require("./pawapay.service");
const logger = require("../utils/logger");
const { enqueue } = require("./registration_job.service");
const { requestHashFor } = require("./pass_issuance.service");
const { getPaymentConfig } = require("../config/payment");
const { commissionBpsFor, getTicketingConfig, splitAmount } = require("../config/ticketing");
const { selectProviderConfiguration, roundForProvider } = require("./payment/policy");
const { normalizePhoneNumber, maskPhoneNumber, extractPawaPayFailure, publicPaymentFailureMessage } = require("./payment/format");
const { unwrapDepositStatus, amountsMatch } = require("./payment/reconciliation");
const { ticketQrAllowance } = require("./organization_quota.service");
const { RegistrationError, assertTicketQrAvailable, clean, emailPattern, heldPlaces, isPaidOffer, sha256, snapshotOffer, uuidPattern } = require("./registration.service");

const OPEN_STATUSES = ["PENDING", "PROCESSING"];
const FINAL_STATUSES = ["COMPLETED", "FAILED", "EXPIRED", "REFUNDED", "REVIEW_REQUIRED"];
const PROVIDER_CACHE_MS = 60_000;
// Une initiation dont pawaPay n'a aucune trace après ce délai n'aboutira plus.
const NOT_FOUND_GRACE_MS = 5 * 60_000;
const REFRESH_THROTTLE_MS = 4_000;

const paymentInclude = { offer: true, form: { include: { event: true } } };

const assertEnabled = () => {
    if (!getTicketingConfig().enabled) {
        throw new RegistrationError("Le paiement des billets est temporairement indisponible.", "TICKET_PAYMENTS_DISABLED", 503);
    }
};

let providerCache = { at: 0, providers: null };
// Opérateurs actifs du compte pawaPay, mis en cache une minute : la page publique les demande à chaque affichage.
const activeProviders = async (now = Date.now()) => {
    if (providerCache.providers && now - providerCache.at < PROVIDER_CACHE_MS) return providerCache.providers;
    const { providerAllowlist } = getPaymentConfig();
    const providers = pawaPay.extractProviders(await pawaPay.getActiveConfiguration()).filter(provider => (
        provider.supportsDeposit !== false
        && provider.currency
        && (providerAllowlist.length === 0 || providerAllowlist.includes(provider.provider))
    ));
    providerCache = { at: now, providers };
    return providers;
};

const resetProviderCache = () => { providerCache = { at: 0, providers: null }; };

// Seuls les opérateurs qui acceptent la devise de l'offre, avec une précision compatible avec son prix.
const providersForOffer = async offer => (await activeProviders()).filter(provider => (
    provider.currency === offer.currency
    && roundForProvider(offer.price, provider.decimals) === Number(offer.price)
));

const loadPublicOffer = async (slug, offerId) => {
    if (!uuidPattern.test(clean(offerId, 50))) throw new RegistrationError("Offre invalide.", "OFFER_NOT_FOUND", 404);
    const offer = await prisma.registrationOffer.findFirst({
        where: { registration_offer_id: clean(offerId, 50), is_active: true, form: { public_slug: clean(slug, 80) } }
    });
    if (!offer) throw new RegistrationError("Offre invalide.", "OFFER_NOT_FOUND", 404);
    if (!isPaidOffer(offer)) throw new RegistrationError("Cette offre est gratuite.", "OFFER_IS_FREE", 409);
    return offer;
};

const listOfferProviders = async (slug, offerId) => {
    assertEnabled();
    const offer = await loadPublicOffer(slug, offerId);
    return (await providersForOffer(offer)).map(provider => ({
        provider: provider.provider,
        displayName: provider.displayName,
        country: provider.country,
        countryDisplayName: provider.countryDisplayName,
        prefix: provider.prefix,
        currency: provider.currency
    }));
};

const serializeTicketPayment = payment => ({
    id: payment.ticket_payment_id,
    status: payment.status,
    amount: String(payment.amount),
    currency: payment.currency,
    provider: payment.provider,
    phoneNumber: maskPhoneNumber(payment.phone_number),
    offerName: payment.offer?.name || null,
    eventTitle: payment.form?.event?.title || null,
    ticketId: payment.registration_id,
    failureMessage: payment.status === "EXPIRED"
        ? "La demande de paiement a expiré. Vous pouvez recommencer."
        : payment.status === "REVIEW_REQUIRED"
            ? "Votre paiement a été reçu mais l’offre était complète. Il sera vérifié et remboursé si nécessaire."
            : payment.failure_message
                ? publicPaymentFailureMessage({ failureCode: payment.failure_code, failureMessage: payment.failure_message })
                : null,
    createdAt: payment.created_at,
    completedAt: payment.completed_at
});

const customerMessage = "AccessQ billet";

const initiate = async (slug, input, submissionKey, attendee) => {
    assertEnabled();
    const key = clean(submissionKey, 500);
    if (!key) throw new RegistrationError("Une clé Idempotency-Key est requise.", "IDEMPOTENCY_KEY_REQUIRED", 400);
    if (!attendee?.attendee_id) throw new RegistrationError("Connectez-vous à votre box pour acheter un billet.", "ATTENDEE_AUTH_REQUIRED", 401);
    const name = clean(attendee.full_name, 160);
    const email = clean(attendee.email, 320).toLowerCase();
    if (!name || !emailPattern.test(email)) throw new RegistrationError("Nom et email valide requis.", "INVALID_PARTICIPANT", 422);
    const holderPhone = clean(input.phone, 40) || null;
    const offerId = clean(input.offerId, 50);
    const providerCode = clean(input.provider, 60).toUpperCase();
    const countryCode = clean(input.country, 3).toUpperCase();
    const payerPhone = clean(input.payerPhone, 40);
    const keyHash = sha256(key);
    const requestHash = requestHashFor({ attendeeId: attendee.attendee_id, holderPhone, offerId, providerCode, countryCode, payerPhone });

    const replay = async () => {
        const existing = await prisma.ticketPayment.findFirst({
            where: { form: { public_slug: clean(slug, 80) }, submission_key_hash: keyHash },
            include: paymentInclude
        });
        if (!existing) return null;
        if (existing.request_hash !== requestHash || existing.attendee_id !== attendee.attendee_id) {
            throw new RegistrationError("Cette demande a déjà été utilisée avec d’autres données.", "IDEMPOTENCY_KEY_CONFLICT", 409);
        }
        return { payment: existing, replayed: true };
    };
    const previous = await replay();
    if (previous) return previous;

    const offer = await loadPublicOffer(slug, offerId);
    const provider = selectProviderConfiguration(await providersForOffer(offer), providerCode, countryCode, offer.currency);
    const phoneNumber = normalizePhoneNumber(payerPhone, { country: provider.country, prefix: provider.prefix });
    const config = getTicketingConfig();

    const reserve = () => prisma.$transaction(async tx => {
        const formRows = await tx.$queryRaw(Prisma.sql`SELECT registration_form_id FROM registration_forms WHERE public_slug = ${clean(slug, 80)} FOR UPDATE`);
        if (!formRows.length) throw new RegistrationError("Formulaire introuvable.", "FORM_NOT_FOUND", 404);
        const form = await tx.registrationForm.findUnique({ where: { registration_form_id: formRows[0].registration_form_id }, include: { organization: true } });
        const now = new Date();
        if (form.status !== "PUBLISHED" || (form.opens_at && form.opens_at > now) || (form.closes_at && form.closes_at <= now)) {
            throw new RegistrationError("Ce formulaire n’accepte pas d’inscription.", "FORM_CLOSED", 409);
        }
        if (!form.organization?.is_active || form.organization.deleted_at) throw new RegistrationError("Cette billetterie est suspendue.", "FORM_CLOSED", 409);
        if (form.phone_required && !holderPhone) throw new RegistrationError("Le téléphone est requis.", "INVALID_PARTICIPANT", 422);
        await tx.$queryRaw(Prisma.sql`SELECT registration_offer_id FROM registration_offers WHERE registration_offer_id = ${offer.registration_offer_id}::uuid FOR UPDATE`);
        const current = await tx.registrationOffer.findUnique({ where: { registration_offer_id: offer.registration_offer_id } });
        if (!current.is_active || current.registration_form_id !== form.registration_form_id) throw new RegistrationError("Cette offre n’est plus disponible.", "OFFER_CLOSED", 409);
        // Le prix a pu changer depuis l'affichage : l'acheteur doit revoir le récapitulatif.
        if (!isPaidOffer(current) || !new Prisma.Decimal(current.price).equals(offer.price) || current.currency !== offer.currency) {
            throw new RegistrationError("Le prix de cette offre a changé. Vérifiez le récapitulatif.", "OFFER_PRICE_CHANGED", 409);
        }
        if (current.capacity !== null && await heldPlaces(tx, current.registration_offer_id, now) >= current.capacity) {
            throw new RegistrationError("Cette offre est complète.", "OFFER_SOLD_OUT", 409);
        }
        await assertTicketQrAvailable(tx, form, now);
        const commissionBps = commissionBpsFor(form.organization, config);
        const split = splitAmount(current.price, commissionBps, provider.decimals);
        return tx.ticketPayment.create({
            data: {
                deposit_id: crypto.randomUUID(),
                org_id: form.org_id,
                registration_form_id: form.registration_form_id,
                registration_offer_id: current.registration_offer_id,
                attendee_id: attendee.attendee_id,
                submission_key_hash: keyHash,
                request_hash: requestHash,
                holder_phone: holderPhone,
                amount: current.price,
                currency: current.currency,
                commission_bps: commissionBps,
                commission_amount: split.commission,
                organizer_amount: split.organizer,
                country: provider.country,
                provider: provider.provider,
                phone_number: phoneNumber,
                hold_expires_at: new Date(now.getTime() + config.holdMinutes * 60_000)
            },
            include: paymentInclude
        });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    let payment;
    for (let attempt = 1; !payment; attempt += 1) {
        try {
            payment = await reserve();
        } catch (error) {
            if (error?.code === "P2002") {
                const raced = await replay();
                if (raced) return raced;
            }
            if (error?.code !== "P2034" || attempt === 3) throw error;
        }
    }

    const payload = {
        depositId: payment.deposit_id,
        amount: new Prisma.Decimal(payment.amount).toString(),
        currency: payment.currency,
        payer: { type: "MMO", accountDetails: { phoneNumber, provider: provider.provider } },
        clientReferenceId: `ACCESSQ-TICKET-${payment.ticket_payment_id.slice(0, 8)}`,
        customerMessage,
        metadata: [
            { organizationId: String(payment.org_id), isPII: false },
            { registrationOfferId: payment.registration_offer_id, isPII: false },
            { ticketPaymentId: payment.ticket_payment_id, isPII: false }
        ]
    };
    try {
        const response = await pawaPay.initiateDeposit(payload);
        const accepted = ["ACCEPTED", "DUPLICATE_IGNORED", "PROCESSING"].includes(response?.status);
        const failure = extractPawaPayFailure(response);
        if (!accepted) {
            logger.warn("ticket_payment.pawapay_rejected", { ticket_payment_id: payment.ticket_payment_id, org_id: payment.org_id, pawapay_failure_code: failure.code, pawapay_failure_message: failure.message });
        }
        payment = await prisma.ticketPayment.update({
            where: { ticket_payment_id: payment.ticket_payment_id },
            data: accepted
                ? { status: response.status === "PROCESSING" ? "PROCESSING" : "PENDING", provider_payload: response }
                : { status: "FAILED", failure_code: failure.code || "REJECTED", failure_message: failure.message || failure.code || "REJECTED", provider_payload: response },
            include: paymentInclude
        });
    } catch (error) {
        // Issue incertaine : la demande a pu partir. Le paiement reste ouvert et la réconciliation tranchera.
        const failure = extractPawaPayFailure(error.responseData);
        logger.error("ticket_payment.initiation_uncertain", { ticket_payment_id: payment.ticket_payment_id, org_id: payment.org_id, pawapay_failure_code: failure.code, pawapay_failure_message: failure.message, error });
    }
    logger.info("ticket_payment.initiated", { ticket_payment_id: payment.ticket_payment_id, org_id: payment.org_id, status: payment.status, attendee_id: attendee.attendee_id });
    return { payment, replayed: false };
};

// Crée le billet (et la ligne de solde) pour un dépôt confirmé. Idempotent : verrou sur le paiement.
const fulfil = async (paymentId, remote) => {
    const draft = await prisma.ticketPayment.findUnique({ where: { ticket_payment_id: paymentId }, include: { offer: true, attendee: true } });
    const offerSnapshot = await snapshotOffer(draft.offer, draft.org_id);
    return prisma.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT ticket_payment_id FROM ticket_payments WHERE ticket_payment_id = ${paymentId}::uuid FOR UPDATE`);
        const current = await tx.ticketPayment.findUnique({ where: { ticket_payment_id: paymentId } });
        if (FINAL_STATUSES.includes(current.status)) return current;
        const now = new Date();
        const providerFields = { provider_transaction_id: remote.providerTransactionId || null, provider_payload: remote, completed_at: now, failure_code: null, failure_message: null };

        await tx.$queryRaw(Prisma.sql`SELECT registration_offer_id FROM registration_offers WHERE registration_offer_id = ${current.registration_offer_id}::uuid FOR UPDATE`);
        const offer = await tx.registrationOffer.findUnique({ where: { registration_offer_id: current.registration_offer_id }, include: { form: true } });
        // Réservation expirée et offre ou quota de QR remplis entre-temps : on ne vend pas une place qui ne pourrait
        // pas être émise, l'achat part en vérification (remboursement depuis la console).
        if (current.hold_expires_at <= now) {
            const capacityFull = offer.capacity !== null && await heldPlaces(tx, offer.registration_offer_id, now) >= offer.capacity;
            const allowance = capacityFull ? null : await ticketQrAllowance(tx, { organizationId: current.org_id, eventId: offer.form.event_id, now });
            const quotaFull = Boolean(allowance && (allowance.expired || (allowance.remaining !== null && allowance.remaining <= 0)));
            if (capacityFull || quotaFull) {
                const failureCode = capacityFull ? "OFFER_SOLD_OUT_AFTER_HOLD" : "EVENT_QR_QUOTA_AFTER_HOLD";
                logger.error("ticket_payment.completed_after_sold_out", { ticket_payment_id: paymentId, org_id: current.org_id, reason: failureCode });
                return tx.ticketPayment.update({ where: { ticket_payment_id: paymentId }, data: { ...providerFields, status: "REVIEW_REQUIRED", failure_code: failureCode } });
            }
        }
        const registration = await tx.registration.create({ data: {
            org_id: current.org_id,
            event_id: (await tx.registrationForm.findUnique({ where: { registration_form_id: current.registration_form_id }, select: { event_id: true } })).event_id,
            registration_form_id: current.registration_form_id,
            registration_offer_id: current.registration_offer_id,
            owner_attendee_id: current.attendee_id,
            submission_key_hash: current.submission_key_hash,
            request_hash: current.request_hash,
            holder_name: draft.attendee.full_name,
            holder_email: draft.attendee.email,
            holder_phone: current.holder_phone,
            offer_snapshot: offerSnapshot
        } });
        await enqueue(registration.registration_id, "ISSUE_PASS", tx);
        await tx.organizerLedgerEntry.create({ data: {
            org_id: current.org_id,
            type: "TICKET_SALE",
            amount: current.organizer_amount,
            currency: current.currency,
            ticket_payment_id: current.ticket_payment_id
        } });
        return tx.ticketPayment.update({ where: { ticket_payment_id: paymentId }, data: { ...providerFields, status: "COMPLETED", registration_id: registration.registration_id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

const reconcile = async (depositId, now = new Date()) => {
    const existing = await prisma.ticketPayment.findUnique({ where: { deposit_id: depositId } });
    if (!existing) return null;
    if (FINAL_STATUSES.includes(existing.status)) return existing;

    const response = await pawaPay.checkDeposit(depositId);
    const remote = unwrapDepositStatus(response);
    if (!remote) {
        if (response?.status === "NOT_FOUND" && now - existing.created_at > NOT_FOUND_GRACE_MS) {
            return prisma.ticketPayment.update({ where: { ticket_payment_id: existing.ticket_payment_id }, data: { status: "FAILED", failure_code: "NOT_FOUND", failure_message: "La demande de paiement n’a pas été reçue par l’opérateur." } });
        }
        return existing;
    }
    if (
        remote.depositId !== existing.deposit_id
        || !amountsMatch(existing.amount, remote.amount)
        || remote.currency !== existing.currency
        || (remote.country && remote.country !== existing.country)
        || (remote.payer?.accountDetails?.provider && remote.payer.accountDetails.provider !== existing.provider)
        || (remote.payer?.accountDetails?.phoneNumber && remote.payer.accountDetails.phoneNumber !== existing.phone_number)
    ) {
        logger.error("ticket_payment.reconciliation_mismatch", { ticket_payment_id: existing.ticket_payment_id, org_id: existing.org_id });
        return prisma.ticketPayment.update({ where: { ticket_payment_id: existing.ticket_payment_id }, data: { status: "REVIEW_REQUIRED", failure_code: "RECONCILIATION_MISMATCH", provider_payload: remote } });
    }
    if (remote.status === "COMPLETED") {
        let completed;
        for (let attempt = 1; !completed; attempt += 1) {
            try { completed = await fulfil(existing.ticket_payment_id, remote); }
            catch (error) { if (error?.code !== "P2034" || attempt === 3) throw error; }
        }
        logger.info("ticket_payment.completed", { ticket_payment_id: completed.ticket_payment_id, org_id: completed.org_id, status: completed.status, registration_id: completed.registration_id });
        return completed;
    }
    if (remote.status === "FAILED") {
        const failure = remote.failureReason || {};
        logger.warn("ticket_payment.pawapay_failed", { ticket_payment_id: existing.ticket_payment_id, org_id: existing.org_id, pawapay_failure_code: failure.failureCode || "FAILED" });
        return prisma.ticketPayment.update({ where: { ticket_payment_id: existing.ticket_payment_id }, data: {
            status: "FAILED",
            failure_code: failure.failureCode || "FAILED",
            failure_message: failure.failureMessage || failure.failureCode || "FAILED",
            provider_payload: remote
        } });
    }
    return prisma.ticketPayment.update({ where: { ticket_payment_id: existing.ticket_payment_id }, data: { status: "PROCESSING", provider_payload: remote } });
};

const isTicketDeposit = async depositId => (
    uuidPattern.test(String(depositId || "")) && Boolean(await prisma.ticketPayment.findUnique({ where: { deposit_id: String(depositId) }, select: { ticket_payment_id: true } }))
);

// Suivi par l'acheteur : la page interroge régulièrement, pawaPay n'est consulté qu'au plus toutes les quelques secondes.
const getForAttendee = async (attendeeId, paymentId, now = new Date()) => {
    if (!uuidPattern.test(String(paymentId || ""))) throw new RegistrationError("Paiement introuvable.", "TICKET_PAYMENT_NOT_FOUND", 404);
    const find = () => prisma.ticketPayment.findFirst({ where: { ticket_payment_id: paymentId, attendee_id: attendeeId }, include: paymentInclude });
    const payment = await find();
    if (!payment) throw new RegistrationError("Paiement introuvable.", "TICKET_PAYMENT_NOT_FOUND", 404);
    if (OPEN_STATUSES.includes(payment.status) && getTicketingConfig().enabled && now - payment.updated_at >= REFRESH_THROTTLE_MS) {
        try {
            await reconcile(payment.deposit_id, now);
            return find();
        } catch (error) {
            logger.warn("ticket_payment.refresh_failed", { ticket_payment_id: paymentId, error });
        }
    }
    return payment;
};

const reconcilePending = async (now = new Date()) => {
    if (!getTicketingConfig().enabled) return { payments: 0 };
    const retryBefore = new Date(now.getTime() - 2 * 60_000);
    const expireBefore = new Date(now.getTime() - 24 * 60 * 60_000);
    const payments = await prisma.ticketPayment.findMany({
        where: { status: { in: OPEN_STATUSES }, created_at: { lte: retryBefore } },
        select: { ticket_payment_id: true, deposit_id: true, created_at: true },
        orderBy: { created_at: "asc" },
        take: 50
    });
    for (const payment of payments) {
        try {
            const result = await reconcile(payment.deposit_id, now);
            if (payment.created_at <= expireBefore && OPEN_STATUSES.includes(result?.status)) {
                await prisma.ticketPayment.update({ where: { ticket_payment_id: payment.ticket_payment_id }, data: { status: "EXPIRED", failure_code: "PAYMENT_EXPIRED", failure_message: "La demande de paiement a expiré." } });
            }
        } catch (error) {
            const failure = extractPawaPayFailure(error.responseData);
            logger.warn("ticket_payment.background_reconciliation_failed", { ticket_payment_id: payment.ticket_payment_id, pawapay_failure_code: failure.code, error });
        }
    }
    return { payments: payments.length };
};

// Solde de l'organisateur par devise, et ventes récentes. Le solde est la somme du journal.
const organizationBalance = async orgId => {
    const [ledger, sales, recent] = await Promise.all([
        prisma.organizerLedgerEntry.groupBy({ by: ["currency"], where: { org_id: orgId }, _sum: { amount: true } }),
        prisma.ticketPayment.groupBy({ by: ["currency"], where: { org_id: orgId, status: "COMPLETED" }, _sum: { amount: true, commission_amount: true }, _count: { _all: true } }),
        prisma.ticketPayment.findMany({ where: { org_id: orgId, status: { in: ["COMPLETED", "REVIEW_REQUIRED", "REFUND_PENDING", "REFUNDED"] } }, include: { offer: true, attendee: { select: { full_name: true } } }, orderBy: { completed_at: "desc" }, take: 20 })
    ]);
    const currencies = [...new Set([...ledger.map(row => row.currency), ...sales.map(row => row.currency)])].sort();
    return {
        defaultCommissionPercent: getTicketingConfig().defaultCommissionBps / 100,
        balances: currencies.map(currency => {
            const sale = sales.find(row => row.currency === currency);
            return {
                currency,
                balance: String(ledger.find(row => row.currency === currency)?._sum.amount || 0),
                gross: String(sale?._sum.amount || 0),
                commission: String(sale?._sum.commission_amount || 0),
                ticketsSold: sale?._count._all || 0
            };
        }),
        recentSales: recent.map(payment => ({
            id: payment.ticket_payment_id,
            status: payment.status,
            offerName: payment.offer.name,
            buyerName: payment.attendee.full_name,
            amount: String(payment.amount),
            commission: String(payment.commission_amount),
            organizerAmount: String(payment.organizer_amount),
            commissionPercent: payment.commission_bps / 100,
            currency: payment.currency,
            completedAt: payment.completed_at
        }))
    };
};

module.exports = {
    getForAttendee,
    initiate,
    isTicketDeposit,
    listOfferProviders,
    organizationBalance,
    reconcile,
    reconcilePending,
    resetProviderCache,
    serializeTicketPayment
};
