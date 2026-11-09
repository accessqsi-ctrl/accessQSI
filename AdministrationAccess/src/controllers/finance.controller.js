const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { writeAudit } = require('../services/audit.service');
const { verifySuperAdminPassword } = require('../services/super-admin.service');

// La console ne parle jamais à pawaPay : elle valide ou refuse en base, le backend AccessQ exécute et vérifie.
const financePath = (type, message) => `/finance?${type}=${encodeURIComponent(message)}`;
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const cleanReason = (value) => String(value || '').trim().slice(0, 500);
// Un compte de réception modifié récemment mérite une vérification avant de valider.
const RECENT_ACCOUNT_CHANGE_MS = 48 * 60 * 60 * 1000;
const OPEN_PAYOUT_STATUSES = ['REQUESTED', 'APPROVED', 'SUBMITTING', 'PROCESSING'];
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

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
                include: { organization: { select: { name: true } } },
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
        const balances = await loadBalances(now);
        res.render('finance', {
            user: req.user,
            requested: requested.map((payout) => {
                const account = accounts.find((item) => item.org_id === payout.org_id && item.currency === payout.currency);
                return { ...payout, accountUpdatedAt: account?.updated_at || null, accountRecentlyChanged: Boolean(account && now - account.updated_at.getTime() < RECENT_ACCOUNT_CHANGE_MS) };
            }),
            recentPayouts,
            balances,
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
