const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcrypt');

const loadController = (prisma) => {
    const prismaPath = require.resolve(path.join(process.cwd(), 'src/lib/prisma.js'));
    const auditPath = require.resolve(path.join(process.cwd(), 'src/services/audit.service.js'));
    for (const file of ['src/controllers/finance.controller.js', 'src/services/super-admin.service.js']) {
        delete require.cache[require.resolve(path.join(process.cwd(), file))];
    }
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
    require.cache[auditPath] = { id: auditPath, filename: auditPath, loaded: true, exports: { writeAudit: () => {} } };
    return require(path.join(process.cwd(), 'src/controllers/finance.controller.js'));
};

const response = () => ({ destination: null, redirect(destination) { this.destination = destination; return this; } });
const payoutId = '7d3f1c1e-1111-4a1a-9a1a-111111111111';

test('payout decisions require the super-admin password and a pending payout', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const updates = [];
    const controller = loadController({
        userQ: { findFirst: async () => ({ password_hash: passwordHash }) },
        organizerPayout: {
            updateMany: async (args) => { updates.push(args); return { count: updates.length === 1 ? 1 : 0 }; },
            findUnique: async () => ({ org_id: 3 })
        }
    });

    let res = response();
    await controller.approvePayout({ params: { id: payoutId }, body: { superAdminPassword: 'wrong' }, user: { id: 1 } }, res);
    assert.equal(updates.length, 0);
    assert.match(res.destination, /Mot%20de%20passe%20incorrect/);

    res = response();
    await controller.approvePayout({ params: { id: payoutId }, body: { superAdminPassword: 'correct-password' }, user: { id: 1 } }, res);
    assert.deepEqual(updates[0].where, { payout_id: payoutId, status: 'REQUESTED' });
    assert.equal(updates[0].data.status, 'APPROVED');
    assert.match(res.destination, /success=/);

    res = response();
    await controller.approvePayout({ params: { id: payoutId }, body: { superAdminPassword: 'correct-password' }, user: { id: 1 } }, res);
    assert.match(res.destination, /plus%20en%20attente/);

    res = response();
    await controller.rejectPayout({ params: { id: payoutId }, body: { superAdminPassword: 'correct-password', reason: ' ' }, user: { id: 1 } }, res);
    assert.match(res.destination, /motif/);
});

test('a rejected payout returns its amount to the organizer balance', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const ledger = [];
    const tx = {
        organizerPayout: {
            updateMany: async () => ({ count: 1 }),
            findUnique: async () => ({ payout_id: payoutId, org_id: 3, amount: '22.81', currency: 'USD' })
        },
        organizerLedgerEntry: { create: async ({ data }) => { ledger.push(data); } }
    };
    const controller = loadController({ userQ: { findFirst: async () => ({ password_hash: passwordHash }) }, $transaction: (work) => work(tx) });
    const res = response();
    await controller.rejectPayout({ params: { id: payoutId }, body: { superAdminPassword: 'correct-password', reason: 'Compte suspect' }, user: { id: 1 } }, res);
    assert.deepEqual(ledger, [{ org_id: 3, type: 'PAYOUT_REVERSAL', amount: '22.81', currency: 'USD', payout_id: payoutId }]);
    assert.match(res.destination, /success=/);
});

test('a refund can only be requested for a payment under review and resets a failed attempt', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const upserts = [];
    let reviewable = true;
    const tx = {
        ticketPayment: {
            updateMany: async ({ where }) => { assert.equal(where.status, 'REVIEW_REQUIRED'); return { count: reviewable ? 1 : 0 }; },
            findUnique: async () => ({ org_id: 3 })
        },
        ticketRefund: { upsert: async (args) => { upserts.push(args); } }
    };
    const controller = loadController({ userQ: { findFirst: async () => ({ password_hash: passwordHash }) }, $transaction: (work) => work(tx) });
    let res = response();
    await controller.refundTicketPayment({ params: { id: payoutId }, body: { superAdminPassword: 'correct-password', reason: 'Offre complète' }, user: { id: 1 } }, res);
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0].update.status, 'PENDING');
    assert.equal(upserts[0].update.submitted_at, null);
    assert.notEqual(upserts[0].update.provider_refund_id, upserts[0].where.ticket_payment_id);
    assert.match(res.destination, /success=/);

    reviewable = false;
    res = response();
    await controller.refundTicketPayment({ params: { id: payoutId }, body: { superAdminPassword: 'correct-password', reason: 'Offre complète' }, user: { id: 1 } }, res);
    assert.equal(upserts.length, 1);
    assert.match(res.destination, /error=/);
});

test('a super-admin payout needs the password and goes only to the registered account', async () => {
    const { Prisma } = require('@prisma/client');
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const created = { payouts: [], ledger: [] };
    let state;
    const reset = (overrides = {}) => {
        state = { account: { country: 'COD', provider: 'VODACOM_MPESA_COD', phone_number: '243991234567' }, open: null, balance: '22.81', ...overrides };
        created.payouts.length = 0;
        created.ledger.length = 0;
    };
    let transactions = 0;
    const tx = {
        $queryRaw: async () => [],
        organizerPayoutAccount: { findUnique: async () => state.account },
        organizerPayout: {
            findFirst: async () => state.open,
            create: async ({ data }) => { created.payouts.push(data); return { ...data, payout_id: 'p-1' }; }
        },
        organizerLedgerEntry: {
            aggregate: async () => ({ _sum: { amount: new Prisma.Decimal(state.balance) } }),
            create: async ({ data }) => { created.ledger.push(data); }
        }
    };
    const controller = loadController({
        userQ: { findFirst: async () => ({ password_hash: passwordHash }) },
        $transaction: (work) => { transactions += 1; return work(tx); }
    });
    const pay = async (body) => {
        const res = response();
        await controller.createPayout({ params: { orgId: '3' }, body: { superAdminPassword: 'correct-password', currency: 'USD', ...body }, user: { id: 1 } }, res);
        return res.destination;
    };

    reset();
    assert.match(await pay({ superAdminPassword: 'wrong' }), /Mot%20de%20passe%20incorrect/);
    assert.equal(transactions, 0);

    // Un numéro envoyé avec le formulaire est ignoré : seule la destination enregistrée compte.
    assert.match(await pay({ amount: '10', phone_number: '243000000000' }), /success=/);
    assert.equal(created.payouts[0].phone_number, '243991234567');
    assert.equal(created.payouts[0].status, 'APPROVED');
    assert.equal(created.payouts[0].reviewed_by_id, 1);
    assert.equal(created.payouts[0].amount.toString(), '10');
    assert.equal(created.ledger[0].type, 'PAYOUT');
    assert.equal(created.ledger[0].amount.toString(), '-10');

    reset();
    await pay({});
    assert.equal(created.payouts[0].amount.toString(), '22.81');

    reset();
    assert.match(await pay({ amount: '30' }), /d%C3%A9passe/);
    assert.equal(created.payouts.length, 0);
    reset({ account: null });
    assert.match(await pay({}), /compte%20de%20r%C3%A9ception/);
    reset({ open: { payout_id: 'busy' } });
    assert.match(await pay({}), /d%C3%A9j%C3%A0%20en%20cours/);
    reset({ balance: '0' });
    assert.match(await pay({}), /Aucun%20montant/);
    reset();
    assert.match(await pay({ amount: '1.234' }), /Montant%20invalide/);
    assert.equal(created.payouts.length, 0);
});
