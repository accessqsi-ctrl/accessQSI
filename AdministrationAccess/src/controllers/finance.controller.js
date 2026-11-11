const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { writeAudit } = require('../services/audit.service');
const { verifySuperAdminPassword } = require('../services/super-admin.service');
const { PAYOUT_COUNTRIES, findCountry, findProvider, normalizeRecipientPhone } = require('../services/payout-recipient.service');

// La console ne parle jamais à pawaPay : elle valide ou refuse en base, le backend AccessQ exécute et vérifie.
const financePath = (type, message) => `/finance?${type}=${encodeURIComponent(message)}`;
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const cleanReason = (value) => String(value || '').trim().slice(0, 500);
// Un compte de réception modifié récemment mérite une vérification avant de valider.
const RECENT_ACCOUNT_CHANGE_MS = 48 * 60 * 60 * 1000;
const OPEN_PAYOUT_STATUSES = ['REQUESTED', 'APPROVED', 'SUBMITTING', 'PROCESSING'];
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
// Un reversement échoué, refusé ou annulé n'a pas fait sortir d'argent.
const SETTLED_OUT_STATUSES = ['FAILED', 'REJECTED', 'CANCELED'];

// Solde de la plateforme par devise : abonnements et pass payés + commissions sur les billets vendus,
// moins les reversements de la plateforme (sans organisation) en cours ou réussis. Les frais pawaPay n'y figurent pas.
const loadPlatformBalances = async (client = prisma) => {
    const [subscriptions, commissions, payouts] = await Promise.all([
        client.payment.groupBy({ by: ['currency'], where: { status: 'COMPLETED' }, _sum: { amount: true } }),
        client.ticketPayment.groupBy({ by: ['currency'], where: { status: 'COMPLETED' }, _sum: { commission_amount: true } }),
        client.organizerPayout.groupBy({ by: ['currency'], where: { org_id: null, status: { notIn: SETTLED_OUT_STATUSES } }, _sum: { amount: true } })
    ]);
    const rows = new Map();
    const row = (currency) => {
        if (!rows.has(currency)) rows.set(currency, { currency, subscriptions: new Prisma.Decimal(0), commissions: new Prisma.Decimal(0), payouts: new Prisma.Decimal(0) });
        return rows.get(currency);
    };
    subscriptions.forEach((item) => { row(item.currency).subscriptions = new Prisma.Decimal(item._sum.amount || 0); });
    commissions.forEach((item) => { row(item.currency).commissions = new Prisma.Decimal(item._sum.commission_amount || 0); });
    payouts.forEach((item) => { row(item.currency).payouts = new Prisma.Decimal(item._sum.amount || 0); });
    return [...rows.values()]
        .map((item) => ({ ...item, balance: item.subscriptions.plus(item.commissions).minus(item.payouts) }))
        .sort((a, b) => a.currency.localeCompare(b.currency));
};

// Opérations qui n'ont pas encore quitté le wallet pawaPay (un reversement « en cours » chez pawaPay est déjà débité).
const NOT_YET_DEBITED_PAYOUT_STATUSES = ['REQUESTED', 'APPROVED', 'SUBMITTING'];
// Au-delà, le relevé pawaPay est signalé comme ancien (le backend le renouvelle toutes les 5 minutes).
const WALLET_STALE_MS = 15 * 60 * 1000;
const zero = () => new Prisma.Decimal(0);
const sumBy = (rows, field) => {
    const totals = new Map();
    rows.forEach((item) => totals.set(item.currency, (totals.get(item.currency) || zero()).plus(new Prisma.Decimal(item._sum[field] || 0))));
    return totals;
};

// Solde réel de la plateforme d'après le dernier relevé des wallets pawaPay (frais et ajustements pawaPay compris) :
// wallet − soldes dus aux organisateurs − reversements pas encore débités − achats à vérifier ou à rembourser.
// L'écart avec le solde calculé correspond surtout aux frais pawaPay. Sans relevé, `wallet` est nul.
const loadPlatformReconciliation = async (platformBalances, client = prisma, now = Date.now()) => {
    const [wallets, ledger, pendingPayouts, reserved] = await Promise.all([
        client.pawaPayWalletBalance.findMany({ orderBy: [{ currency: 'asc' }, { country: 'asc' }] }),
        client.organizerLedgerEntry.groupBy({ by: ['org_id', 'currency'], _sum: { amount: true } }),
        client.organizerPayout.groupBy({ by: ['currency'], where: { status: { in: NOT_YET_DEBITED_PAYOUT_STATUSES } }, _sum: { amount: true } }),
        client.ticketPayment.groupBy({
            by: ['currency'],
            where: { OR: [{ status: 'REVIEW_REQUIRED' }, { status: 'REFUND_PENDING', refund: { status: 'PENDING' } }] },
            _sum: { amount: true }
        })
    ]);
    const owed = sumBy(ledger.filter((item) => new Prisma.Decimal(item._sum.amount || 0).gt(0)), 'amount');
    const pending = sumBy(pendingPayouts, 'amount');
    const held = sumBy(reserved, 'amount');
    const computed = new Map(platformBalances.map((item) => [item.currency, item.balance]));
    const currencies = [...new Set([...wallets.map((item) => item.currency), ...computed.keys()])].sort();
    return currencies.map((currency) => {
        const currencyWallets = wallets.filter((item) => item.currency === currency);
        const fetchedAt = currencyWallets.length ? new Date(Math.min(...currencyWallets.map((item) => item.fetched_at.getTime()))) : null;
        const wallet = currencyWallets.length ? currencyWallets.reduce((total, item) => total.plus(item.balance), zero()) : null;
        const row = {
            currency,
            wallet,
            wallets: currencyWallets.map((item) => ({ country: item.country, provider: item.provider, balance: new Prisma.Decimal(item.balance) })),
            fetchedAt,
            stale: !fetchedAt || now - fetchedAt.getTime() > WALLET_STALE_MS,
            owedToOrganizers: owed.get(currency) || zero(),
            pendingPayouts: pending.get(currency) || zero(),
            reservedPayments: held.get(currency) || zero(),
            computed: computed.get(currency) || zero()
        };
        row.available = wallet === null ? null : wallet.minus(row.owedToOrganizers).minus(row.pendingPayouts).minus(row.reservedPayments);
        row.gap = row.available === null ? null : row.available.minus(row.computed);
        return row;
    });
};

// Soldes positifs par organisation et devise, avec le compte de réception et l'éventuel reversement en cours.
const loadBalances = async (now) => {
    const ledger = await prisma.organizerLedgerEntry.groupBy({ by: ['org_id', 'currency'], _sum: { amount: true } });
    const positive = ledger.filter((row) => row._sum.amount && new Prisma.Decimal(row._sum.amount).gt(0));
    if (!positive.length) return [];
    const pairs = positive.map((row) => ({ org_id: row.org_id, currency: row.currency }));
    const [organizations, accounts, openPayouts] = await Promise.all([
        prisma.organization.findMany({ where: { org_id: { in: [...new Set(positive.map((row) => row.org_id))] } }, select: { org_id: true, name: true } }),
        prisma.organizerPayoutAccount.findMany({ where: { OR: pairs } }),
        prisma.organizerPayout.findMany({ where: { OR: pairs, status: { in: OPEN_PAYOUT_STATUSES } }, select: { org_id: true, currency: true } })
    ]);
    return positive.map((row) => {
        const account = accounts.find((item) => item.org_id === row.org_id && item.currency === row.currency) || null;
        return {
            orgId: row.org_id,
            organizationName: organizations.find((item) => item.org_id === row.org_id)?.name || `#${row.org_id}`,
            currency: row.currency,
            balance: String(row._sum.amount),
            account,
            accountRecentlyChanged: Boolean(account && now - account.updated_at.getTime() < RECENT_ACCOUNT_CHANGE_MS),
            payoutInProgress: openPayouts.some((item) => item.org_id === row.org_id && item.currency === row.currency)
        };
    }).sort((a, b) => a.organizationName.localeCompare(b.organizationName, 'fr') || a.currency.localeCompare(b.currency));
};

exports.showFinance = async (req, res) => {
    try {
        const [requested, recentPayouts, reviewPayments, recentRefunds] = await Promise.all([
            prisma.organizerPayout.findMany({
                where: { status: 'REQUESTED' },
                include: { organization: { select: { name: true } }, requested_by: { select: { full_name: true, email: true } } },
                orderBy: { created_at: 'asc' }
            }),
            prisma.organizerPayout.findMany({
                where: { status: { not: 'REQUESTED' } },
                include: { organization: { select: { name: true } }, requested_by: { select: { full_name: true } } },
                orderBy: { updated_at: 'desc' },
                take: 30
            }),
            prisma.ticketPayment.findMany({
                where: { status: 'REVIEW_REQUIRED' },
                include: { organization: { select: { name: true } }, offer: { select: { name: true } }, attendee: { select: { full_name: true, email: true } }, refund: true },
                orderBy: { completed_at: 'asc' }
            }),
            prisma.ticketRefund.findMany({
                include: { ticket_payment: { include: { organization: { select: { name: true } }, attendee: { select: { full_name: true } } } } },
                orderBy: { updated_at: 'desc' },
                take: 30
            })
        ]);
        const accounts = requested.length ? await prisma.organizerPayoutAccount.findMany({
            where: { OR: requested.map((payout) => ({ org_id: payout.org_id, currency: payout.currency })) }
        }) : [];
        const now = Date.now();
        const [balances, platformBalances] = await Promise.all([loadBalances(now), loadPlatformBalances()]);
        const reconciliation = await loadPlatformReconciliation(platformBalances, prisma, now);
        res.render('finance', {
            user: req.user,
            requested: requested.map((payout) => {
                const account = accounts.find((item) => item.org_id === payout.org_id && item.currency === payout.currency);
                return { ...payout, accountUpdatedAt: account?.updated_at || null, accountRecentlyChanged: Boolean(account && now - account.updated_at.getTime() < RECENT_ACCOUNT_CHANGE_MS) };
            }),
            recentPayouts,
            balances,
            platformBalances,
            reconciliation,
            payoutCountries: PAYOUT_COUNTRIES,
            reviewPayments,
            recentRefunds,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Erreur showFinance:', error);
        res.redirect('/dashboard?error=Erreur lors du chargement des finances.');
    }
};

exports.approvePayout = async (req, res) => {
    const payoutId = req.params.id;
    if (!isUuid(payoutId)) return res.redirect(financePath('error', 'Reversement invalide.'));
    try {
        if (!await verifySuperAdminPassword(req)) {
            writeAudit({ actorId: req.user.id, action: 'PAYOUT_APPROVE', targetType: 'PAYOUT', targetId: payoutId, outcome: 'DENIED' });
            return res.redirect(financePath('error', 'Mot de passe incorrect. Le reversement n’a pas été validé.'));
        }
        const result = await prisma.organizerPayout.updateMany({
            where: { payout_id: payoutId, status: 'REQUESTED' },
            data: { status: 'APPROVED', reviewed_by_id: Number(req.user.id), reviewed_at: new Date() }
        });
        if (result.count !== 1) return res.redirect(financePath('error', 'Ce reversement n’est plus en attente de validation.'));
        const payout = await prisma.organizerPayout.findUnique({ where: { payout_id: payoutId }, select: { org_id: true } });
        writeAudit({ actorId: req.user.id, action: 'PAYOUT_APPROVE', targetType: 'PAYOUT', targetId: payoutId, organizationId: payout.org_id });
        res.redirect(financePath('success', 'Reversement validé. Il sera envoyé par AccessQ dans la minute.'));
    } catch (error) {
        console.error('Erreur approvePayout:', error);
        res.redirect(financePath('error', 'Erreur lors de la validation.'));
    }
};

exports.rejectPayout = async (req, res) => {
    const payoutId = req.params.id;
    const reason = cleanReason(req.body.reason);
    if (!isUuid(payoutId)) return res.redirect(financePath('error', 'Reversement invalide.'));
    if (!reason) return res.redirect(financePath('error', 'Indiquez le motif du refus : il est communiqué à l’organisateur.'));
    try {
        if (!await verifySuperAdminPassword(req)) {
            writeAudit({ actorId: req.user.id, action: 'PAYOUT_REJECT', targetType: 'PAYOUT', targetId: payoutId, outcome: 'DENIED' });
            return res.redirect(financePath('error', 'Mot de passe incorrect. Le reversement n’a pas été refusé.'));
        }
        const payout = await prisma.$transaction(async (tx) => {
            const result = await tx.organizerPayout.updateMany({
                where: { payout_id: payoutId, status: 'REQUESTED' },
                data: { status: 'REJECTED', reviewed_by_id: Number(req.user.id), reviewed_at: new Date(), failure_code: 'REJECTED_BY_ADMIN', failure_message: reason }
            });
            if (result.count !== 1) return null;
            const rejected = await tx.organizerPayout.findUnique({ where: { payout_id: payoutId } });
            // Le montant retiré du solde à la demande y revient.
            await tx.organizerLedgerEntry.create({ data: { org_id: rejected.org_id, type: 'PAYOUT_REVERSAL', amount: rejected.amount, currency: rejected.currency, payout_id: rejected.payout_id } });
            return rejected;
        });
        if (!payout) return res.redirect(financePath('error', 'Ce reversement n’est plus en attente de validation.'));
        writeAudit({ actorId: req.user.id, action: 'PAYOUT_REJECT', targetType: 'PAYOUT', targetId: payoutId, organizationId: payout.org_id });
        res.redirect(financePath('success', 'Reversement refusé. Le montant est revenu sur le solde de l’organisateur.'));
    } catch (error) {
        console.error('Erreur rejectPayout:', error);
        res.redirect(financePath('error', 'Erreur lors du refus.'));
    }
};

// Rembourse un achat « à vérifier » au payeur d'origine. Un remboursement échoué peut être relancé.
exports.refundTicketPayment = async (req, res) => {
    const paymentId = req.params.id;
    const reason = cleanReason(req.body.reason);
    if (!isUuid(paymentId)) return res.redirect(financePath('error', 'Paiement invalide.'));
    if (!reason) return res.redirect(financePath('error', 'Indiquez le motif du remboursement.'));
    try {
        if (!await verifySuperAdminPassword(req)) {
            writeAudit({ actorId: req.user.id, action: 'TICKET_REFUND_REQUEST', targetType: 'TICKET_PAYMENT', targetId: paymentId, outcome: 'DENIED' });
            return res.redirect(financePath('error', 'Mot de passe incorrect. Aucun remboursement n’a été demandé.'));
        }
        const payment = await prisma.$transaction(async (tx) => {
            const result = await tx.ticketPayment.updateMany({ where: { ticket_payment_id: paymentId, status: 'REVIEW_REQUIRED' }, data: { status: 'REFUND_PENDING' } });
            if (result.count !== 1) return null;
            const fresh = {
                provider_refund_id: crypto.randomUUID(),
                status: 'PENDING',
                reason,
                requested_by_id: Number(req.user.id),
                submitted_at: null,
                failure_code: null,
                failure_message: null,
                provider_payload: undefined
            };
            await tx.ticketRefund.upsert({ where: { ticket_payment_id: paymentId }, create: { ticket_payment_id: paymentId, ...fresh }, update: fresh });
            return tx.ticketPayment.findUnique({ where: { ticket_payment_id: paymentId }, select: { org_id: true } });
        });
        if (!payment) return res.redirect(financePath('error', 'Ce paiement n’est plus à vérifier.'));
        writeAudit({ actorId: req.user.id, action: 'TICKET_REFUND_REQUEST', targetType: 'TICKET_PAYMENT', targetId: paymentId, organizationId: payment.org_id });
        res.redirect(financePath('success', 'Remboursement demandé. Il sera envoyé au payeur d’origine dans la minute.'));
    } catch (error) {
        console.error('Erreur refundTicketPayment:', error);
        res.redirect(financePath('error', 'Erreur lors de la demande de remboursement.'));
    }
};

class PayoutRefusal extends Error {}

// Reversement décidé par le super-admin : toujours vers le compte de réception enregistré par l'organisateur,
// jamais vers un numéro saisi dans la console. Créé déjà validé ; le backend l'envoie dans la minute.
exports.createPayout = async (req, res) => {
    const orgId = Number.parseInt(req.params.orgId, 10);
    const currency = String(req.body.currency || '').trim().toUpperCase();
    const rawAmount = String(req.body.amount ?? '').trim().replace(',', '.');
    if (!Number.isInteger(orgId) || orgId <= 0 || !CURRENCY_PATTERN.test(currency)) return res.redirect(financePath('error', 'Organisation ou devise invalide.'));
    if (rawAmount && !/^\d{1,12}(\.\d{1,2})?$/.test(rawAmount)) return res.redirect(financePath('error', 'Montant invalide (deux décimales au plus).'));
    try {
        if (!await verifySuperAdminPassword(req)) {
            writeAudit({ actorId: req.user.id, action: 'PAYOUT_CREATE', targetType: 'ORGANIZATION', targetId: orgId, organizationId: orgId, outcome: 'DENIED' });
            return res.redirect(financePath('error', 'Mot de passe incorrect. Aucun reversement n’a été créé.'));
        }
        const run = () => prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`;
            const account = await tx.organizerPayoutAccount.findUnique({ where: { org_id_currency: { org_id: orgId, currency } } });
            if (!account) throw new PayoutRefusal('Cette organisation n’a pas de compte de réception pour cette devise.');
            const open = await tx.organizerPayout.findFirst({ where: { org_id: orgId, currency, status: { in: OPEN_PAYOUT_STATUSES } } });
            if (open) throw new PayoutRefusal('Un reversement est déjà en cours pour cette organisation et cette devise.');
            const sum = await tx.organizerLedgerEntry.aggregate({ where: { org_id: orgId, currency }, _sum: { amount: true } });
            const balance = new Prisma.Decimal(sum._sum.amount || 0);
            const amount = rawAmount ? new Prisma.Decimal(rawAmount) : balance;
            if (amount.lte(0)) throw new PayoutRefusal('Aucun montant disponible à reverser.');
            if (amount.gt(balance)) throw new PayoutRefusal('Le montant dépasse le solde disponible.');
            const now = new Date();
            const payout = await tx.organizerPayout.create({ data: {
                provider_payout_id: crypto.randomUUID(),
                org_id: orgId,
                amount,
                currency,
                country: account.country,
                provider: account.provider,
                phone_number: account.phone_number,
                status: 'APPROVED',
                requested_by_id: Number(req.user.id),
                reviewed_by_id: Number(req.user.id),
                reviewed_at: now
            } });
            await tx.organizerLedgerEntry.create({ data: { org_id: orgId, type: 'PAYOUT', amount: amount.neg(), currency, payout_id: payout.payout_id } });
            return payout;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        let payout;
        for (let attempt = 1; !payout; attempt += 1) {
            try { payout = await run(); }
            catch (error) { if (error?.code !== 'P2034' || attempt === 3) throw error; }
        }
        writeAudit({ actorId: req.user.id, action: 'PAYOUT_CREATE', targetType: 'PAYOUT', targetId: payout.payout_id, organizationId: orgId });
        res.redirect(financePath('success', `Reversement de ${payout.amount} ${currency} créé. Il sera envoyé par AccessQ dans la minute.`));
    } catch (error) {
        if (error instanceof PayoutRefusal) return res.redirect(financePath('error', error.message));
        console.error('Erreur createPayout:', error);
        res.redirect(financePath('error', 'Erreur lors de la création du reversement.'));
    }
};

// Reversement saisi entièrement par le super-admin : pays, opérateur, devise, montant et numéro du bénéficiaire.
// Prélevé sur le solde d'une organisation si elle est choisie, sinon sur le solde de la plateforme.
// L'opérateur choisi est envoyé tel quel ; le backend vérifie seulement qu'il accepte les reversements dans ce pays et cette devise.
exports.createManualPayout = async (req, res) => {
    const rawOrg = String(req.body.org_id ?? '').trim();
    const orgId = rawOrg ? Number.parseInt(rawOrg, 10) : null;
    const country = findCountry(req.body.country);
    const currency = String(req.body.currency || '').trim().toUpperCase();
    const rawAmount = String(req.body.amount ?? '').trim().replace(',', '.');
    const note = cleanReason(req.body.note);
    if (rawOrg && (!Number.isInteger(orgId) || orgId <= 0 || String(orgId) !== rawOrg)) return res.redirect(financePath('error', 'Organisation invalide.'));
    if (!country) return res.redirect(financePath('error', 'Choisissez le pays du bénéficiaire.'));
    const provider = findProvider(country, req.body.provider);
    if (!provider) return res.redirect(financePath('error', `Choisissez l’opérateur Mobile Money du bénéficiaire (${country.name}).`));
    if (!country.currencies.includes(currency)) return res.redirect(financePath('error', `Devise non disponible pour ${country.name}.`));
    if (!AMOUNT_PATTERN.test(rawAmount) || new Prisma.Decimal(rawAmount).lte(0)) return res.redirect(financePath('error', 'Montant invalide (deux décimales au plus).'));
    const phoneNumber = normalizeRecipientPhone(req.body.phone_number, country);
    if (!phoneNumber) return res.redirect(financePath('error', `Numéro invalide pour ${country.name} (indicatif +${country.prefix}).`));
    if (!note) return res.redirect(financePath('error', 'Indiquez le motif du reversement.'));
    const amount = new Prisma.Decimal(rawAmount);
    try {
        if (!await verifySuperAdminPassword(req)) {
            writeAudit({ actorId: req.user.id, action: 'PAYOUT_CREATE_MANUAL', targetType: orgId ? 'ORGANIZATION' : 'PLATFORM', targetId: orgId || 'platform', organizationId: orgId, outcome: 'DENIED' });
            return res.redirect(financePath('error', 'Mot de passe incorrect. Aucun reversement n’a été créé.'));
        }
        const run = () => prisma.$transaction(async (tx) => {
            if (orgId) {
                const locked = await tx.$queryRaw`SELECT org_id FROM organizations WHERE org_id = ${orgId} FOR UPDATE`;
                if (!locked.length) throw new PayoutRefusal('Organisation introuvable.');
                const open = await tx.organizerPayout.findFirst({ where: { org_id: orgId, currency, status: { in: OPEN_PAYOUT_STATUSES } } });
                if (open) throw new PayoutRefusal('Un reversement est déjà en cours pour cette organisation et cette devise.');
                const sum = await tx.organizerLedgerEntry.aggregate({ where: { org_id: orgId, currency }, _sum: { amount: true } });
                if (amount.gt(new Prisma.Decimal(sum._sum.amount || 0))) throw new PayoutRefusal('Le montant dépasse le solde disponible de l’organisation.');
            } else {
                // Un seul reversement de la plateforme à la fois vérifie le solde.
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('accessq_platform_payout'))`;
                const platformBalances = await loadPlatformBalances(tx);
                const platform = platformBalances.find((item) => item.currency === currency);
                if (!platform || amount.gt(platform.balance)) throw new PayoutRefusal(`Le montant dépasse le solde de la plateforme en ${currency}.`);
                // Le solde réel pawaPay (frais déduits) peut être inférieur au solde calculé : on retient le plus petit.
                const real = (await loadPlatformReconciliation(platformBalances, tx)).find((item) => item.currency === currency);
                if (real?.available && amount.gt(real.available)) {
                    throw new PayoutRefusal(`Le montant dépasse le solde réel de la plateforme sur pawaPay (${real.available.toFixed(2)} ${currency}, frais déduits).`);
                }
            }
            const now = new Date();
            const payout = await tx.organizerPayout.create({ data: {
                provider_payout_id: crypto.randomUUID(),
                org_id: orgId,
                amount,
                currency,
                country: country.code,
                provider: provider.code,
                phone_number: phoneNumber,
                manual_recipient: true,
                note,
                status: 'APPROVED',
                requested_by_id: Number(req.user.id),
                reviewed_by_id: Number(req.user.id),
                reviewed_at: now
            } });
            if (orgId) await tx.organizerLedgerEntry.create({ data: { org_id: orgId, type: 'PAYOUT', amount: amount.neg(), currency, payout_id: payout.payout_id } });
            return payout;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        let payout;
        for (let attempt = 1; !payout; attempt += 1) {
            try { payout = await run(); }
            catch (error) { if (error?.code !== 'P2034' || attempt === 3) throw error; }
        }
        writeAudit({ actorId: req.user.id, action: 'PAYOUT_CREATE_MANUAL', targetType: 'PAYOUT', targetId: payout.payout_id, organizationId: orgId });
        res.redirect(financePath('success', `Reversement de ${payout.amount} ${currency} vers +${phoneNumber} (${provider.name}) créé. Il sera envoyé par AccessQ dans la minute.`));
    } catch (error) {
        if (error instanceof PayoutRefusal) return res.redirect(financePath('error', error.message));
        console.error('Erreur createManualPayout:', error);
        res.redirect(financePath('error', 'Erreur lors de la création du reversement.'));
    }
};

exports.loadPlatformBalances = loadPlatformBalances;
exports.loadPlatformReconciliation = loadPlatformReconciliation;
