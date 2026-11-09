const test = require("node:test");
const assert = require("node:assert/strict");

const enabled = process.env.ACCESSQ_POSTGRES_INTEGRATION === "1";
const safeDatabase = (() => {
    try { return new URL(process.env.DATABASE_URL || "").pathname.includes("accessq_v1_test"); }
    catch { return false; }
})();

test("free registration flow is atomic on PostgreSQL", { skip: !enabled || !safeDatabase }, async t => {
    const prisma = require("../src/prisma/client");
    const registrations = require("../src/services/registration.service");
    const jobs = require("../src/services/registration_job.service");
    const accessTokens = require("../src/services/registration_access.service");
    const cards = require("../src/services/registration_card.service");
    const emailService = require("../src/services/email.service");
    const worker = require("../src/workers/registration.worker");
    const passIssuance = require("../src/services/pass_issuance.service");
    const box = require("../src/services/box.service");
    const boxQr = require("../src/services/box_qr.service");
    const qrVerify = require("../src/services/qr_verify.service");
    const ticketPayments = require("../src/services/ticket_payment.service");
    const pawaPay = require("../src/services/pawapay.service");
    const payouts = require("../src/services/organizer_payout.service");

    const cleanup = async () => {
        await prisma.organizerLedgerEntry.deleteMany();
        await prisma.ticketRefund.deleteMany();
        await prisma.organizerPayout.deleteMany();
        await prisma.organizerPayoutAccount.deleteMany();
        await prisma.ticketPayment.deleteMany();
        await prisma.registrationJob.deleteMany();
        await prisma.registrationEmailDelivery.deleteMany();
        await prisma.registrationAccessToken.deleteMany();
        await prisma.registration.deleteMany();
        await prisma.attendee.deleteMany({ where: { email: { endsWith: "@example.test" } } });
        await prisma.registrationOffer.deleteMany();
        await prisma.registrationForm.deleteMany();
        await prisma.passIssuanceRequest.deleteMany();
        await prisma.scanLog.deleteMany();
        await prisma.qrCode.deleteMany();
        await prisma.event.deleteMany();
        await prisma.userQ.deleteMany({ where: { email: { endsWith: "@example.test" } } });
        await prisma.organization.deleteMany();
    };
    await cleanup();
    t.after(async () => { await cleanup(); await prisma.$disconnect(); });

    const org = await prisma.organization.create({ data: { name: "PostgreSQL V1 test" } });
    const otherOrg = await prisma.organization.create({ data: { name: "Other tenant" } });
    const event = await prisma.event.create({ data: { org_id: org.org_id, title: "Concert test", qr_limit: 10 } });
    const attendeeFor = (email, fullName) => prisma.attendee.upsert({ where: { email }, create: { email, full_name: fullName, email_verified_at: new Date() }, update: {} });

    await t.test("last offer place and submission idempotency", async () => {
        let form = await registrations.createForm(org.org_id, {
            eventId: event.event_id,
            title: "Places limitées",
            offers: [{ name: "Gratuit", capacity: 1, cardTemplateId: "event-ticket" }]
        });
        form = await registrations.setFormStatus(org.org_id, form.registration_form_id, "PUBLISHED");
        const attendees = { one: await attendeeFor("one@example.test", "Participant one"), two: await attendeeFor("two@example.test", "Participant two") };
        const command = suffix => registrations.submit(form.public_slug, { offerId: form.offers[0].registration_offer_id }, `key-${suffix}`, attendees[suffix]);
        const settled = await Promise.allSettled([command("one"), command("two")]);
        assert.equal(settled.filter(result => result.status === "fulfilled").length, 1);
        assert.equal(settled.filter(result => result.status === "rejected" && result.reason.code === "OFFER_SOLD_OUT").length, 1);
        const winner = settled.find(result => result.status === "fulfilled").value;
        const winnerKey = winner.registration.holder_email.includes("one") ? "one" : "two";
        assert.equal(winner.registration.owner_attendee_id, attendees[winnerKey].attendee_id);
        const replay = await registrations.submit(form.public_slug, { offerId: form.offers[0].registration_offer_id }, `key-${winnerKey}`, attendees[winnerKey]);
        assert.equal(replay.replayed, true);
        assert.equal(replay.registration.registration_id, winner.registration.registration_id);
        await assert.rejects(
            registrations.submit(form.public_slug, { offerId: form.offers[0].registration_offer_id, phone: "+243810000000" }, `key-${winnerKey}`, attendees[winnerKey]),
            error => error.code === "IDEMPOTENCY_KEY_CONFLICT"
        );
        await assert.rejects(
            registrations.submit(form.public_slug, { offerId: form.offers[0].registration_offer_id }, "key-anonymous", null),
            error => error.code === "ATTENDEE_AUTH_REQUIRED"
        );
        const updated = await registrations.updateForm(org.org_id, form.registration_form_id, {
            title: form.title,
            opensAt: form.opens_at,
            closesAt: form.closes_at,
            offers: [{ id: form.offers[0].registration_offer_id, name: "Gratuit actualisé", capacity: 1, level: 3, cardTemplateId: "event-ticket" }]
        });
        assert.equal(updated.offers[0].level, 3);
        const preserved = await prisma.registration.findUnique({ where: { registration_id: winner.registration.registration_id } });
        assert.equal(preserved.offer_snapshot.level, 1);
        await prisma.registrationJob.updateMany({ where: { registration_id: winner.registration.registration_id }, data: { status: "COMPLETED", completed_at: new Date() } });
    });

    await t.test("job leases, exactly one pass, box email and box ownership", async () => {
        const form = await registrations.setFormStatus(org.org_id, (await registrations.createForm(org.org_id, {
            eventId: event.event_id,
            title: "Parcours complet",
            offers: [{ name: "Standard", cardTemplateId: "event-ticket", accessType: "multi", usageLimit: 2 }]
        })).registration_form_id, "PUBLISHED");
        const ada = await attendeeFor("ada@example.test", "Ada Lovelace");
        const submitted = await registrations.submit(form.public_slug, { offerId: form.offers[0].registration_offer_id }, "ada-submit", ada);

        const snapshot = submitted.registration.offer_snapshot;
        const orphanedIssuance = await passIssuance.issuePass({
            organizationId: org.org_id,
            eventId: event.event_id,
            input: { fullName: "Ada Lovelace", email: "ada@example.test", accessType: snapshot.accessType, limit: snapshot.usageLimit, level: snapshot.level, cardTemplateId: snapshot.cardTemplateId },
            trustedTemplateSnapshot: snapshot.cardTemplateSnapshot,
            idempotency: { scope: `registration:${submitted.registration.registration_id}`, key: submitted.registration.registration_id }
        });
        assert.equal(orphanedIssuance.replayed, false);

        const [claimA, claimB] = await Promise.all([jobs.claimNext({ id: "worker-a" }), jobs.claimNext({ id: "worker-b" })]);
        assert.equal([claimA, claimB].filter(Boolean).length, 1);
        const issueJob = claimA || claimB;
        await worker.processIssuePass(issueJob);
        await worker.processIssuePass(issueJob);
        const completed = await prisma.registration.findUnique({ where: { registration_id: submitted.registration.registration_id }, include: { qr_code: true, event: { include: { EventSchedules: { include: { area: true } } } } } });
        assert.equal(completed.status, "COMPLETED");
        assert.equal(completed.issuance_status, "SUCCEEDED");
        assert.equal(await prisma.qrCode.count({ where: { event_id: event.event_id, holder_email: "ada@example.test" } }), 1);
        assert.equal(await prisma.passIssuanceRequest.count({ where: { qr_id: completed.qr_id } }), 1);
        const pdf = await cards.generateRegistrationPassPdf(completed);
        assert.equal(pdf.subarray(0, 4).toString(), "%PDF");

        const emailJob = await jobs.claimNext({ id: "email-worker" });
        let captured;
        emailService.sendBoxTicketEmail = async message => { captured = message; return { messageId: "test-message" }; };
        await worker.processEmail(emailJob);
        assert.equal(captured.toEmail, "ada@example.test");
        assert.match(captured.boxUrl, new RegExp(`/box/tickets/${completed.registration_id}$`));
        // Un billet de box ne reçoit jamais de lien d'accès par email.
        assert.equal(await prisma.registrationAccessToken.count({ where: { registration_id: completed.registration_id } }), 0);
        const emailed = await prisma.registration.findUnique({ where: { registration_id: completed.registration_id } });
        assert.equal(emailed.email_status, "ACCEPTED");

        await registrations.reacquireCapacityAndEnqueue(org.org_id, completed.registration_id, "SEND_PASS_EMAIL");
        const failedEmailJob = await prisma.registrationJob.findFirst({ where: { registration_id: completed.registration_id, type: "SEND_PASS_EMAIL", status: "PENDING" }, orderBy: { created_at: "desc" } });
        await prisma.registrationJob.update({ where: { registration_job_id: failedEmailJob.registration_job_id }, data: { max_attempts: 1 } });
        emailService.sendBoxTicketEmail = async () => { throw new Error("test provider outage"); };
        const failedClaim = await jobs.claimNext({ id: "email-failure-worker" });
        await worker.processEmail(failedClaim);
        const afterEmailFailure = await prisma.registration.findUnique({ where: { registration_id: completed.registration_id } });
        assert.equal(afterEmailFailure.email_status, "FAILED");
        assert.equal(afterEmailFailure.qr_id, completed.qr_id);

        const second = await registrations.submit(form.public_slug, { offerId: form.offers[0].registration_offer_id }, "ada-second-submit", ada);
        const secondIssueJob = await jobs.claimNext({ id: "second-pass-worker" });
        await worker.processIssuePass(secondIssueJob);
        await prisma.registrationJob.updateMany({ where: { registration_id: second.registration.registration_id, type: "SEND_PASS_EMAIL", status: "PENDING" }, data: { status: "COMPLETED", completed_at: new Date() } });
        // Les billets de box ne passent pas par la récupération par lien.
        assert.equal(await registrations.queueRecovery("ADA@example.test", form.public_slug), 0);

        const tickets = await box.listTickets(ada.attendee_id);
        assert.equal(tickets.length, 2);
        assert.ok(tickets.every(ticket => ticket.qrAvailable && ticket.pdfAvailable));
        const { image: png, expiresAt } = await box.renderTicketQr(ada.attendee_id, completed.registration_id);
        assert.equal(png.subarray(1, 4).toString(), "PNG");
        // Billet téléchargeable : QR statique, identique au PDF, sans échéance.
        assert.equal(expiresAt, null);
        const stranger = await attendeeFor("stranger@example.test", "Stranger");
        await assert.rejects(box.getTicket(stranger.attendee_id, completed.registration_id), error => error.code === "TICKET_NOT_FOUND");
        await assert.rejects(box.renderTicketQr(stranger.attendee_id, completed.registration_id), error => error.code === "TICKET_NOT_FOUND");
    });

    await t.test("box-only offers never produce a PDF and require the rotating QR", async () => {
        const form = await registrations.setFormStatus(org.org_id, (await registrations.createForm(org.org_id, {
            eventId: event.event_id,
            title: "QR dans la box",
            offers: [{ name: "Box", cardTemplateId: "event-ticket", boxOnlyQr: true }]
        })).registration_form_id, "PUBLISHED");
        assert.equal(form.offers[0].box_only_qr, true);
        const grace = await attendeeFor("grace@example.test", "Grace Hopper");
        const submitted = await registrations.submit(form.public_slug, { offerId: form.offers[0].registration_offer_id }, "grace-submit", grace);
        assert.equal(submitted.registration.offer_snapshot.boxOnlyQr, true);
        await worker.processIssuePass(await jobs.claimNext({ id: "box-only-worker" }));
        const [ticket] = await box.listTickets(grace.attendee_id);
        assert.equal(ticket.qrAvailable, true);
        assert.equal(ticket.pdfAvailable, false);
        await assert.rejects(box.renderTicketPdf(grace.attendee_id, ticket.id), error => error.code === "BOX_ONLY_QR");

        const rendered = await box.renderTicketQr(grace.attendee_id, ticket.id);
        assert.ok(rendered.expiresAt > new Date());
        const scanner = await prisma.userQ.create({ data: { clef: "scanner-box-only", full_name: "Scanner", email: "scanner@example.test", password_hash: "x", role: "ORG_AGENT", org_id: org.org_id, is_verified: true } });
        const qr = await prisma.qrCode.findFirst({ where: { registration: { registration_id: ticket.id } } });
        const scan = extra => qrVerify.verifyAndRecordScan({ token: qr.unique_token, scannerId: scanner.user_id, scannerOrgId: org.org_id, eventId: event.event_id, ...extra });
        // Capture d'écran ou PDF : jeton statique seul, ou code d'une période dépassée.
        const staticScan = await scan({});
        assert.equal(staticScan.decision.scanStatus, "denied_dynamic_code");
        const old = JSON.parse(boxQr.buildDynamicPayload(qr, new Date(Date.now() - 3 * boxQr.STEP_SECONDS * 1000)).payload);
        assert.equal((await scan({ dynamicStep: old.s, dynamicCode: old.c })).decision.scanStatus, "denied_dynamic_code");
        const forged = JSON.parse(boxQr.buildDynamicPayload(qr).payload);
        assert.equal((await scan({ dynamicStep: forged.s, dynamicCode: forged.c.replace(/.$/, forged.c.endsWith("A") ? "B" : "A") })).decision.scanStatus, "denied_dynamic_code");
        const live = JSON.parse(boxQr.buildDynamicPayload(qr).payload);
        const authorized = await scan({ dynamicStep: live.s, dynamicCode: live.c });
        assert.equal(authorized.decision.success, true);
        assert.equal(await prisma.scanLog.count({ where: { qr_code_id: qr.qr_id, status: "denied_dynamic_code" } }), 3);
        assert.equal((await prisma.qrCode.findUnique({ where: { qr_id: qr.qr_id } })).scans_count, 1);
        await prisma.registrationJob.updateMany({ where: { registration_id: ticket.id, status: "PENDING" }, data: { status: "COMPLETED", completed_at: new Date() } });
    });

    await t.test("ticket sales stay within the event QR quota and recover after a downgrade", async () => {
        const limitedEvent = await prisma.event.create({ data: { org_id: org.org_id, title: "Quota test", qr_limit: 2, entitlement_type: "EVENT_PASS", entitlement_expires_at: new Date(Date.now() + 86_400_000) } });
        const member = await prisma.userQ.create({ data: { clef: "quota-member", full_name: "Agent Quota", email: "quota-member@example.test", password_hash: "x", role: "ORG_AGENT", org_id: org.org_id, is_verified: true } });
        const manualPass = (input, extra = {}) => passIssuance.issuePass({ organizationId: org.org_id, eventId: limitedEvent.event_id, input: { accessType: "single", level: 1, cardTemplateId: "event-ticket", ...input }, ...extra });
        await manualPass({ fullName: "Existing pass", email: "existing@example.test" }, { createdById: member.user_id });
        const form = await registrations.setFormStatus(org.org_id, (await registrations.createForm(org.org_id, { eventId: limitedEvent.event_id, title: "Quota blocked", offers: [{ name: "Illimitée", cardTemplateId: "event-ticket" }] })).registration_form_id, "PUBLISHED");
        const offerId = form.offers[0].registration_offer_id;
        assert.equal((await registrations.publicForm(form.public_slug)).offers[0].sold_out, false);
        const submitted = await registrations.submit(form.public_slug, { offerId }, "quota-holder", await attendeeFor("quota@example.test", "Quota Holder"));

        // La place vendue compte déjà : plus de vente, plus de QR manuel, et l'offre s'affiche complète.
        assert.equal((await registrations.publicForm(form.public_slug)).offers[0].sold_out, true);
        await assert.rejects(registrations.submit(form.public_slug, { offerId }, "quota-late", await attendeeFor("late@example.test", "Late Buyer")), error => error.code === "OFFER_SOLD_OUT");
        await assert.rejects(manualPass({ fullName: "Manual", email: "manual@example.test" }), error => error.code === "PLAN_QUOTA_EXCEEDED" && /réservée/.test(error.message));
        const quota = await registrations.formQrAllowance(form);
        assert.deepEqual([quota.limit, quota.issued, quota.reserved, quota.remaining], [2, 1, 1, 0]);

        // Le quota baisse après la vente (changement de plan) : l'émission est bloquée et la place libérée.
        await prisma.event.update({ where: { event_id: limitedEvent.event_id }, data: { qr_limit: 1 } });
        await worker.processIssuePass(await jobs.claimNext({ id: "quota-worker" }));
        const blocked = await prisma.registration.findUnique({ where: { registration_id: submitted.registration.registration_id } });
        assert.equal(blocked.issuance_status, "BLOCKED_QUOTA");
        assert.equal(blocked.capacity_held, false);
        assert.equal(blocked.qr_id, null);
        await assert.rejects(registrations.reacquireCapacityAndEnqueue(org.org_id, blocked.registration_id, "ISSUE_PASS"), error => error.code === "PLAN_QUOTA_EXCEEDED");

        await prisma.event.update({ where: { event_id: limitedEvent.event_id }, data: { qr_limit: 2 } });
        await registrations.reacquireCapacityAndEnqueue(org.org_id, blocked.registration_id, "ISSUE_PASS");
        await worker.processIssuePass(await jobs.claimNext({ id: "quota-retry-worker" }));
        const recovered = await prisma.registration.findUnique({ where: { registration_id: blocked.registration_id } });
        assert.equal(recovered.issuance_status, "SUCCEEDED");
        assert.ok(recovered.qr_id);
        // Origine des QR de l'événement : un par la billetterie, un par l'agent.
        const usage = await require("../src/services/qr.service").getEventQrUsage(org.org_id, limitedEvent.event_id);
        assert.deepEqual([usage.issued, usage.reserved, usage.remaining], [2, 0, 0]);
        assert.equal(usage.sources.ticketing, 1);
        assert.deepEqual(usage.sources.members, [{ userId: member.user_id, name: "Agent Quota", role: "ORG_AGENT", count: 1 }]);
        assert.equal(usage.sources.unattributed, 0);
        assert.equal(await require("../src/services/qr.service").getEventQrUsage(otherOrg.org_id, limitedEvent.event_id), null);
        assert.deepEqual((await registrations.listForms(org.org_id, { eventId: limitedEvent.event_id })).map(item => item.registration_form_id), [form.registration_form_id]);
        await prisma.registrationJob.updateMany({ where: { registration_id: recovered.registration_id, type: "SEND_PASS_EMAIL", status: "PENDING" }, data: { status: "COMPLETED", completed_at: new Date() } });
    });

    await t.test("expired leases are reclaimed and tokens expire or revoke", async () => {
        const registration = await prisma.registration.findFirst({ where: { org_id: org.org_id, issuance_status: "SUCCEEDED" } });
        const stale = await prisma.registrationJob.create({ data: { registration_id: registration.registration_id, type: "SEND_PASS_EMAIL", status: "PROCESSING", attempts: 1, locked_by: "dead-worker", lease_until: new Date(Date.now() - 1000) } });
        const reclaimed = await jobs.claimNext({ id: "replacement-worker" });
        assert.equal(reclaimed.registration_job_id, stale.registration_job_id);
        assert.equal(reclaimed.locked_by, "replacement-worker");
        const expired = await accessTokens.createAccessToken(registration.registration_id, { expiresAt: new Date(Date.now() - 1000) });
        assert.equal(await accessTokens.resolveAccessToken(expired.rawToken), null);
        const revocable = await accessTokens.createAccessToken(registration.registration_id);
        await accessTokens.revokeRegistrationTokens(registration.registration_id);
        assert.equal(await accessTokens.resolveAccessToken(revocable.rawToken), null);
    });

    await t.test("organization reads stay isolated", async () => {
        assert.ok((await registrations.listForms(org.org_id)).length > 0);
        assert.equal((await registrations.listForms(otherOrg.org_id)).length, 0);
        assert.equal(await registrations.getForm(otherOrg.org_id, (await registrations.listForms(org.org_id))[0].registration_form_id), null);
    });

    await t.test("paid offers hold the place, issue only after pawaPay confirms and credit the organizer", async () => {
        const previousEnv = { enabled: process.env.TICKET_PAYMENTS_ENABLED, percent: process.env.TICKET_COMMISSION_PERCENT };
        const originals = { conf: pawaPay.getActiveConfiguration, initiate: pawaPay.initiateDeposit, check: pawaPay.checkDeposit };
        process.env.TICKET_PAYMENTS_ENABLED = "true";
        delete process.env.TICKET_COMMISSION_PERCENT;
        const remote = new Map();
        pawaPay.getActiveConfiguration = async () => ({ countries: [{ country: "COD", prefix: "243", providers: [{ provider: "VODACOM_MPESA_COD", displayName: "M-Pesa", currencies: [{ currency: "USD", operationTypes: { DEPOSIT: { decimals: 2 } } }] }] }] });
        pawaPay.initiateDeposit = async payload => {
            remote.set(payload.depositId, { depositId: payload.depositId, status: "ACCEPTED", amount: payload.amount, currency: payload.currency, country: "COD", payer: payload.payer });
            return { depositId: payload.depositId, status: "ACCEPTED" };
        };
        pawaPay.checkDeposit = async depositId => remote.has(depositId) ? { status: "FOUND", data: remote.get(depositId) } : { status: "NOT_FOUND" };
        ticketPayments.resetProviderCache();
        t.after(() => {
            Object.assign(pawaPay, { getActiveConfiguration: originals.conf, initiateDeposit: originals.initiate, checkDeposit: originals.check });
            if (previousEnv.enabled === undefined) delete process.env.TICKET_PAYMENTS_ENABLED; else process.env.TICKET_PAYMENTS_ENABLED = previousEnv.enabled;
            if (previousEnv.percent !== undefined) process.env.TICKET_COMMISSION_PERCENT = previousEnv.percent;
        });
        const settle = (payment, status, patch = {}) => remote.set(payment.deposit_id, { ...remote.get(payment.deposit_id), status, ...patch });

        await assert.rejects(registrations.createForm(org.org_id, { eventId: event.event_id, title: "Sans devise", offers: [{ name: "VIP", price: "10", cardTemplateId: "event-ticket" }] }), error => error.code === "INVALID_OFFER");
        const form = await registrations.setFormStatus(org.org_id, (await registrations.createForm(org.org_id, {
            eventId: event.event_id,
            title: "Billetterie payante",
            offers: [{ name: "VIP", price: "12,50", currency: "usd", capacity: 1, cardTemplateId: "event-ticket" }]
        })).registration_form_id, "PUBLISHED");
        const offer = form.offers[0];
        assert.equal(String(offer.price), "12.5");
        assert.equal(offer.currency, "USD");
        const buyer = await attendeeFor("buyer@example.test", "Buyer One");
        const rival = await attendeeFor("rival@example.test", "Buyer Two");
        const checkout = (attendee, key, extra = {}) => ticketPayments.initiate(form.public_slug, { offerId: offer.registration_offer_id, provider: "VODACOM_MPESA_COD", country: "COD", payerPhone: "0991234567", ...extra }, key, attendee);

        await assert.rejects(registrations.submit(form.public_slug, { offerId: offer.registration_offer_id }, "free-on-paid", buyer), error => error.code === "PAYMENT_REQUIRED");
        assert.equal((await ticketPayments.listOfferProviders(form.public_slug, offer.registration_offer_id)).length, 1);

        assert.equal((await registrations.publicForm(form.public_slug)).offers[0].sold_out, false);
        const { payment } = await checkout(buyer, "buyer-1");
        // La place réservée par le paiement en cours suffit à afficher l'offre comme complète.
        assert.equal((await registrations.publicForm(form.public_slug)).offers[0].sold_out, true);
        assert.equal(payment.status, "PENDING");
        assert.equal(payment.phone_number, "243991234567");
        assert.equal(String(payment.commission_amount), "1.25");
        assert.equal(String(payment.organizer_amount), "11.25");
        assert.equal(payment.registration_id, null);
        assert.equal((await checkout(buyer, "buyer-1")).replayed, true);
        await assert.rejects(checkout(buyer, "buyer-1", { payerPhone: "0997654321" }), error => error.code === "IDEMPOTENCY_KEY_CONFLICT");
        await assert.rejects(checkout(rival, "rival-1"), error => error.code === "OFFER_SOLD_OUT");
        await assert.rejects(ticketPayments.getForAttendee(rival.attendee_id, payment.ticket_payment_id), error => error.code === "TICKET_PAYMENT_NOT_FOUND");

        settle(payment, "PROCESSING");
        assert.equal((await ticketPayments.reconcile(payment.deposit_id)).status, "PROCESSING");
        assert.equal(await prisma.registration.count({ where: { owner_attendee_id: buyer.attendee_id } }), 0);

        settle(payment, "COMPLETED", { providerTransactionId: "tx-1" });
        const completed = await ticketPayments.reconcile(payment.deposit_id);
        assert.equal(completed.status, "COMPLETED");
        await ticketPayments.reconcile(payment.deposit_id);
        const ticket = await prisma.registration.findUnique({ where: { registration_id: completed.registration_id }, include: { jobs: true } });
        assert.equal(ticket.owner_attendee_id, buyer.attendee_id);
        assert.equal(ticket.offer_snapshot.price, "12.5");
        assert.deepEqual(ticket.jobs.map(job => job.type), ["ISSUE_PASS"]);
        assert.equal(await prisma.organizerLedgerEntry.count({ where: { ticket_payment_id: payment.ticket_payment_id } }), 1);
        await assert.rejects(checkout(rival, "rival-2"), error => error.code === "OFFER_SOLD_OUT");
        await prisma.registrationJob.updateMany({ where: { registration_id: ticket.registration_id }, data: { status: "COMPLETED", completed_at: new Date() } });

        // Taux propre à l'organisation, échec, montant falsifié, et paiement arrivé après expiration de la réservation.
        await prisma.organization.update({ where: { org_id: org.org_id }, data: { ticket_commission_bps: 750 } });
        const open = await registrations.updateForm(org.org_id, form.registration_form_id, { title: form.title, offers: [{ id: offer.registration_offer_id, name: "VIP", price: "12.50", currency: "USD", capacity: 2, cardTemplateId: "event-ticket" }] });
        assert.equal(open.offers[0].capacity, 2);
        const failed = (await checkout(rival, "rival-3")).payment;
        assert.equal(String(failed.commission_amount), "0.94");
        settle(failed, "FAILED", { failureReason: { failureCode: "INSUFFICIENT_BALANCE" } });
        assert.equal((await ticketPayments.reconcile(failed.deposit_id)).status, "FAILED");
        assert.equal((await registrations.publicForm(form.public_slug)).offers[0].sold_out, false);
        const tampered = (await checkout(rival, "rival-4")).payment;
        settle(tampered, "COMPLETED", { amount: "1.00" });
        assert.equal((await ticketPayments.reconcile(tampered.deposit_id)).status, "REVIEW_REQUIRED");
        const late = (await checkout(rival, "rival-5")).payment;
        await prisma.ticketPayment.update({ where: { ticket_payment_id: late.ticket_payment_id }, data: { hold_expires_at: new Date(Date.now() - 1000) } });
        const onTime = (await checkout(buyer, "buyer-2")).payment;
        settle(onTime, "COMPLETED");
        assert.equal((await ticketPayments.reconcile(onTime.deposit_id)).status, "COMPLETED");
        settle(late, "COMPLETED");
        assert.equal((await ticketPayments.reconcile(late.deposit_id)).status, "REVIEW_REQUIRED");
        assert.equal(await prisma.registration.count({ where: { registration_offer_id: offer.registration_offer_id } }), 2);

        const balance = await ticketPayments.organizationBalance(org.org_id);
        assert.equal(balance.defaultCommissionPercent, 10);
        const usd = balance.balances.find(row => row.currency === "USD");
        assert.equal(usd.ticketsSold, 2);
        assert.equal(usd.gross, "25");
        assert.equal(usd.commission, "2.19");
        assert.equal(usd.balance, "22.81");
        assert.equal((await ticketPayments.organizationBalance(otherOrg.org_id)).balances.length, 0);
        await prisma.registrationJob.updateMany({ data: { status: "COMPLETED", completed_at: new Date() } });
    });

    await t.test("payouts leave the balance on request, return on failure and refunds reach the payer", async () => {
        const bcrypt = require("bcrypt");
        const originals = { conf: pawaPay.getActiveConfiguration, payout: pawaPay.initiatePayout, checkPayout: pawaPay.checkPayout, refund: pawaPay.initiateRefund, checkRefund: pawaPay.checkRefund };
        t.after(() => Object.assign(pawaPay, { getActiveConfiguration: originals.conf, initiatePayout: originals.payout, checkPayout: originals.checkPayout, initiateRefund: originals.refund, checkRefund: originals.checkRefund }));
        const remote = new Map();
        let payoutResponse = () => ({ status: "ACCEPTED" });
        const refundRequests = [];
        pawaPay.getActiveConfiguration = async () => ({ countries: [{ country: "COD", prefix: "243", providers: [{ provider: "VODACOM_MPESA_COD", displayName: "M-Pesa", currencies: [{ currency: "USD", operationTypes: { DEPOSIT: { decimals: 2 }, PAYOUT: { decimals: 2 } } }] }] }] });
        pawaPay.initiatePayout = async payload => {
            const response = payoutResponse(payload);
            if (response.status === "ACCEPTED") remote.set(payload.payoutId, { payoutId: payload.payoutId, status: "PROCESSING", amount: payload.amount, currency: payload.currency, recipient: payload.recipient });
            return response;
        };
        pawaPay.checkPayout = async id => remote.has(id) ? { status: "FOUND", data: remote.get(id) } : { status: "NOT_FOUND" };
        pawaPay.initiateRefund = async payload => { refundRequests.push(payload); remote.set(payload.refundId, { refundId: payload.refundId, status: "PROCESSING" }); return { status: "ACCEPTED" }; };
        pawaPay.checkRefund = async id => remote.has(id) ? { status: "FOUND", data: remote.get(id) } : { status: "NOT_FOUND" };
        payouts.resetProviderCache();

        const admin = await prisma.userQ.create({ data: { clef: "payout-admin", full_name: "Org Admin", email: "payout-admin@example.test", password_hash: await bcrypt.hash("Secret#123", 4), role: "ORG_ADMIN", org_id: org.org_id, is_verified: true } });
        const superAdmin = await prisma.userQ.create({ data: { clef: "payout-super", full_name: "Super", email: "payout-super@example.test", password_hash: "x", role: "SUPER_ADMIN", is_verified: true } });
        const usdBalance = async () => (await ticketPayments.organizationBalance(org.org_id)).balances.find(row => row.currency === "USD").balance;
        const approve = payout => prisma.organizerPayout.update({ where: { payout_id: payout.id }, data: { status: "APPROVED", reviewed_by_id: superAdmin.user_id, reviewed_at: new Date() } });
        const payoutRow = payout => prisma.organizerPayout.findUnique({ where: { payout_id: payout.id } });
        const request = amount => payouts.requestPayout(org.org_id, admin.user_id, { currency: "USD", amount, password: "Secret#123" });
        assert.equal(await usdBalance(), "22.81");

        await assert.rejects(payouts.requestPayout(org.org_id, admin.user_id, { currency: "USD", password: "Secret#123" }), error => error.code === "PAYOUT_ACCOUNT_REQUIRED");
        await assert.rejects(payouts.setAccount(org.org_id, admin.user_id, { currency: "USD", provider: "VODACOM_MPESA_COD", country: "COD", phoneNumber: "0991234567", password: "wrong" }), error => error.code === "INVALID_PASSWORD");
        await assert.rejects(payouts.setAccount(org.org_id, admin.user_id, { currency: "CDF", provider: "VODACOM_MPESA_COD", country: "COD", phoneNumber: "0991234567", password: "Secret#123" }), error => error.code === "PROVIDER_NOT_AVAILABLE");
        const account = await payouts.setAccount(org.org_id, admin.user_id, { currency: "USD", provider: "VODACOM_MPESA_COD", country: "COD", phoneNumber: "0991234567", password: "Secret#123" });
        assert.equal(account.phoneNumber, "2439••••567");

        await assert.rejects(request("100"), error => error.code === "INSUFFICIENT_BALANCE");
        const all = await request();
        assert.equal(all.amount, "22.81");
        assert.equal(await usdBalance(), "0");
        await assert.rejects(request("1"), error => error.code === "PAYOUT_IN_PROGRESS");
        await payouts.cancelPayout(org.org_id, all.id);
        assert.equal(await usdBalance(), "22.81");
        await assert.rejects(payouts.cancelPayout(org.org_id, all.id), error => error.code === "PAYOUT_NOT_CANCELABLE");

        // Validé, envoyé puis confirmé par pawaPay.
        const sent = await request("10");
        await payouts.processPending();
        assert.equal((await payoutRow(sent)).status, "REQUESTED");
        await approve(sent);
        await payouts.processPending();
        const processing = await payoutRow(sent);
        assert.equal(processing.status, "PROCESSING");
        remote.set(processing.provider_payout_id, { ...remote.get(processing.provider_payout_id), status: "COMPLETED", providerTransactionId: "po-1" });
        await payouts.processPending();
        assert.equal((await payoutRow(sent)).status, "COMPLETED");
        assert.equal(await usdBalance(), "12.81");

        // Refusé par pawaPay à l'envoi : le montant revient.
        payoutResponse = () => ({ status: "REJECTED", failureReason: { failureCode: "RECIPIENT_NOT_FOUND" } });
        const rejected = await request();
        await approve(rejected);
        await payouts.processPending();
        assert.equal((await payoutRow(rejected)).status, "FAILED");
        assert.equal(await usdBalance(), "12.81");

        // Issue incertaine puis échec final : renvoyé avec le même identifiant, recrédité une seule fois.
        payoutResponse = () => { throw new pawaPay.PawaPayRequestError("timeout"); };
        const retried = await request();
        await approve(retried);
        await payouts.processPending();
        assert.equal((await payoutRow(retried)).status, "APPROVED");
        payoutResponse = () => ({ status: "ACCEPTED" });
        await payouts.processPending();
        const inFlight = await payoutRow(retried);
        assert.equal(inFlight.status, "PROCESSING");
        remote.set(inFlight.provider_payout_id, { ...remote.get(inFlight.provider_payout_id), status: "FAILED", failureReason: { failureCode: "PROVIDER_TEMPORARILY_UNAVAILABLE" } });
        await payouts.processPending();
        await payouts.reconcilePayout(inFlight.provider_payout_id);
        assert.equal((await payoutRow(retried)).status, "FAILED");
        assert.equal(await prisma.organizerLedgerEntry.count({ where: { payout_id: retried.id, type: "PAYOUT_REVERSAL" } }), 1);
        assert.equal(await usdBalance(), "12.81");
        assert.equal((await payouts.getOverview(org.org_id)).payouts.length, 4);

        // Remboursement d'un achat « à vérifier » au payeur d'origine.
        const review = await prisma.ticketPayment.findFirst({ where: { org_id: org.org_id, status: "REVIEW_REQUIRED" } });
        const refund = await prisma.$transaction(async tx => {
            await tx.ticketPayment.update({ where: { ticket_payment_id: review.ticket_payment_id }, data: { status: "REFUND_PENDING" } });
            return tx.ticketRefund.create({ data: { provider_refund_id: require("crypto").randomUUID(), ticket_payment_id: review.ticket_payment_id, reason: "Offre complète", requested_by_id: superAdmin.user_id } });
        });
        assert.equal(await payouts.isTicketRefund(refund.provider_refund_id), true);
        await payouts.processPending();
        assert.deepEqual(refundRequests.map(item => [item.depositId, item.amount, item.currency]), [[review.deposit_id, "12.5", "USD"]]);
        assert.equal((await prisma.ticketRefund.findUnique({ where: { ticket_refund_id: refund.ticket_refund_id } })).status, "PROCESSING");
        remote.set(refund.provider_refund_id, { refundId: refund.provider_refund_id, status: "COMPLETED" });
        await payouts.processPending();
        assert.equal((await prisma.ticketRefund.findUnique({ where: { ticket_refund_id: refund.ticket_refund_id } })).status, "COMPLETED");
        assert.equal((await prisma.ticketPayment.findUnique({ where: { ticket_payment_id: review.ticket_payment_id } })).status, "REFUNDED");
        assert.equal(await usdBalance(), "12.81");
    });

    await t.test("paid sales stop at the event QR quota and a late payment goes to review", async () => {
        const originals = { initiate: pawaPay.initiateDeposit, check: pawaPay.checkDeposit };
        t.after(() => Object.assign(pawaPay, { initiateDeposit: originals.initiate, checkDeposit: originals.check }));
        const remote = new Map();
        pawaPay.initiateDeposit = async payload => { remote.set(payload.depositId, { depositId: payload.depositId, status: "ACCEPTED", amount: payload.amount, currency: payload.currency, country: "COD", payer: payload.payer }); return { status: "ACCEPTED" }; };
        pawaPay.checkDeposit = async id => remote.has(id) ? { status: "FOUND", data: remote.get(id) } : { status: "NOT_FOUND" };
        ticketPayments.resetProviderCache();

        const passEvent = await prisma.event.create({ data: { org_id: org.org_id, title: "Pass payant", qr_limit: 1, entitlement_type: "EVENT_PASS", entitlement_expires_at: new Date(Date.now() + 86_400_000) } });
        const form = await registrations.setFormStatus(org.org_id, (await registrations.createForm(org.org_id, { eventId: passEvent.event_id, title: "Quota payant", offers: [{ name: "Entrée", price: "5", currency: "USD", cardTemplateId: "event-ticket" }] })).registration_form_id, "PUBLISHED");
        const offerId = form.offers[0].registration_offer_id;
        const checkout = (email, key) => attendeeFor(email, email).then(attendee => ticketPayments.initiate(form.public_slug, { offerId, provider: "VODACOM_MPESA_COD", country: "COD", payerPhone: "0991234567" }, key, attendee));

        const first = (await checkout("quota-a@example.test", "quota-a")).payment;
        await assert.rejects(checkout("quota-b@example.test", "quota-b"), error => error.code === "OFFER_SOLD_OUT");
        assert.equal((await registrations.publicForm(form.public_slug)).offers[0].sold_out, true);

        // La réservation expire, un autre acheteur prend la place, puis le premier paiement aboutit trop tard.
        await prisma.ticketPayment.update({ where: { ticket_payment_id: first.ticket_payment_id }, data: { hold_expires_at: new Date(Date.now() - 1000) } });
        const second = (await checkout("quota-c@example.test", "quota-c")).payment;
        remote.set(second.deposit_id, { ...remote.get(second.deposit_id), status: "COMPLETED" });
        assert.equal((await ticketPayments.reconcile(second.deposit_id)).status, "COMPLETED");
        remote.set(first.deposit_id, { ...remote.get(first.deposit_id), status: "COMPLETED" });
        const late = await ticketPayments.reconcile(first.deposit_id);
        assert.equal(late.status, "REVIEW_REQUIRED");
        assert.equal(late.failure_code, "EVENT_QR_QUOTA_AFTER_HOLD");
        assert.equal(await prisma.registration.count({ where: { event_id: passEvent.event_id } }), 1);
        await prisma.registrationJob.updateMany({ data: { status: "COMPLETED", completed_at: new Date() } });
    });
});
