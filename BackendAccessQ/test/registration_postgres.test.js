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

    const cleanup = async () => {
        await prisma.registrationJob.deleteMany();
        await prisma.registrationEmailDelivery.deleteMany();
        await prisma.registrationAccessToken.deleteMany();
        await prisma.registration.deleteMany();
        await prisma.registrationOffer.deleteMany();
        await prisma.registrationForm.deleteMany();
        await prisma.passIssuanceRequest.deleteMany();
        await prisma.qrCode.deleteMany();
        await prisma.event.deleteMany();
        await prisma.organization.deleteMany();
    };
    await cleanup();
    t.after(async () => { await cleanup(); await prisma.$disconnect(); });

    const org = await prisma.organization.create({ data: { name: "PostgreSQL V1 test" } });
    const otherOrg = await prisma.organization.create({ data: { name: "Other tenant" } });
    const event = await prisma.event.create({ data: { org_id: org.org_id, title: "Concert test", qr_limit: 10 } });

    await t.test("last offer place and submission idempotency", async () => {
        let form = await registrations.createForm(org.org_id, {
            eventId: event.event_id,
            title: "Places limitées",
            offers: [{ name: "Gratuit", capacity: 1, cardTemplateId: "event-ticket" }]
        });
        form = await registrations.setFormStatus(org.org_id, form.registration_form_id, "PUBLISHED");
        const command = suffix => registrations.submit(form.public_slug, { fullName: `Participant ${suffix}`, email: `${suffix}@example.test`, offerId: form.offers[0].registration_offer_id }, `key-${suffix}`);
        const settled = await Promise.allSettled([command("one"), command("two")]);
        assert.equal(settled.filter(result => result.status === "fulfilled").length, 1);
        assert.equal(settled.filter(result => result.status === "rejected" && result.reason.code === "OFFER_SOLD_OUT").length, 1);
        const winner = settled.find(result => result.status === "fulfilled").value;
        const replay = await registrations.submit(form.public_slug, {
            fullName: winner.registration.holder_name,
            email: winner.registration.holder_email,
            offerId: form.offers[0].registration_offer_id
        }, winner.registration.holder_email.includes("one") ? "key-one" : "key-two");
        assert.equal(replay.replayed, true);
        assert.equal(replay.registration.registration_id, winner.registration.registration_id);
        await assert.rejects(
            registrations.submit(form.public_slug, { fullName: "Changed", email: winner.registration.holder_email, offerId: form.offers[0].registration_offer_id }, winner.registration.holder_email.includes("one") ? "key-one" : "key-two"),
            error => error.code === "IDEMPOTENCY_KEY_CONFLICT"
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

    await t.test("job leases, exactly one pass, email acceptance and hashed tokens", async () => {
        const form = await registrations.setFormStatus(org.org_id, (await registrations.createForm(org.org_id, {
            eventId: event.event_id,
            title: "Parcours complet",
            offers: [{ name: "Standard", cardTemplateId: "event-ticket", accessType: "multi", usageLimit: 2 }]
        })).registration_form_id, "PUBLISHED");
        const submitted = await registrations.submit(form.public_slug, { fullName: "Ada Lovelace", email: "ada@example.test", offerId: form.offers[0].registration_offer_id }, "ada-submit");

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
        emailService.sendPassAccessEmail = async message => { captured = message; return { messageId: "test-message" }; };
        await worker.processEmail(emailJob);
        assert.equal(captured.toEmail, "ada@example.test");
        assert.match(captured.accessUrl, /\/register\/access\?token=/);
        const rawEmailToken = new URL(captured.accessUrl).searchParams.get("token");
        const stored = await prisma.registrationAccessToken.findUnique({ where: { token_hash: accessTokens.hashToken(rawEmailToken) } });
        assert.ok(stored);
        assert.equal(JSON.stringify(await prisma.registrationJob.findMany()).includes(rawEmailToken), false);
        const emailed = await prisma.registration.findUnique({ where: { registration_id: completed.registration_id } });
        assert.equal(emailed.email_status, "ACCEPTED");

        await registrations.reacquireCapacityAndEnqueue(org.org_id, completed.registration_id, "SEND_PASS_EMAIL");
        const failedEmailJob = await prisma.registrationJob.findFirst({ where: { registration_id: completed.registration_id, type: "SEND_PASS_EMAIL", status: "PENDING" }, orderBy: { created_at: "desc" } });
        await prisma.registrationJob.update({ where: { registration_job_id: failedEmailJob.registration_job_id }, data: { max_attempts: 1 } });
        emailService.sendPassAccessEmail = async () => { throw new Error("test provider outage"); };
        const failedClaim = await jobs.claimNext({ id: "email-failure-worker" });
        await worker.processEmail(failedClaim);
        const afterEmailFailure = await prisma.registration.findUnique({ where: { registration_id: completed.registration_id } });
        assert.equal(afterEmailFailure.email_status, "FAILED");
        assert.equal(afterEmailFailure.qr_id, completed.qr_id);

        const second = await registrations.submit(form.public_slug, { fullName: "Ada Second Pass", email: "ada@example.test", offerId: form.offers[0].registration_offer_id }, "ada-second-submit");
        const secondIssueJob = await jobs.claimNext({ id: "second-pass-worker" });
        await worker.processIssuePass(secondIssueJob);
        await prisma.registrationJob.updateMany({ where: { registration_id: second.registration.registration_id, type: "SEND_PASS_EMAIL", status: "PENDING" }, data: { status: "COMPLETED", completed_at: new Date() } });
        assert.equal(await registrations.queueRecovery("ADA@example.test", form.public_slug), 2);
        assert.equal(await prisma.registrationJob.count({ where: { type: "SEND_PASS_EMAIL", status: "PENDING", registration: { holder_email: "ada@example.test" } } }), 2);
        await prisma.registrationJob.updateMany({ where: { type: "SEND_PASS_EMAIL", status: "PENDING", registration: { holder_email: "ada@example.test" } }, data: { status: "COMPLETED", completed_at: new Date() } });
    });

    await t.test("commercial quota releases capacity and supports controlled recovery", async () => {
        const limitedEvent = await prisma.event.create({ data: { org_id: org.org_id, title: "Quota test", qr_limit: 1, entitlement_type: "EVENT_PASS", entitlement_expires_at: new Date(Date.now() + 86_400_000) } });
        await passIssuance.issuePass({ organizationId: org.org_id, eventId: limitedEvent.event_id, input: { fullName: "Existing pass", email: "existing@example.test", accessType: "single", level: 1, cardTemplateId: "event-ticket" } });
        const form = await registrations.setFormStatus(org.org_id, (await registrations.createForm(org.org_id, { eventId: limitedEvent.event_id, title: "Quota blocked", offers: [{ name: "Unique", capacity: 1, cardTemplateId: "event-ticket" }] })).registration_form_id, "PUBLISHED");
        const submitted = await registrations.submit(form.public_slug, { fullName: "Quota Holder", email: "quota@example.test", offerId: form.offers[0].registration_offer_id }, "quota-holder");
        const issueJob = await jobs.claimNext({ id: "quota-worker" });
        await worker.processIssuePass(issueJob);
        const blocked = await prisma.registration.findUnique({ where: { registration_id: submitted.registration.registration_id } });
        assert.equal(blocked.issuance_status, "BLOCKED_QUOTA");
        assert.equal(blocked.capacity_held, false);
        assert.equal(blocked.qr_id, null);
        await prisma.event.update({ where: { event_id: limitedEvent.event_id }, data: { qr_limit: 2 } });
        await registrations.reacquireCapacityAndEnqueue(org.org_id, blocked.registration_id, "ISSUE_PASS");
        const retryJob = await jobs.claimNext({ id: "quota-retry-worker" });
        await worker.processIssuePass(retryJob);
        const recovered = await prisma.registration.findUnique({ where: { registration_id: blocked.registration_id } });
        assert.equal(recovered.issuance_status, "SUCCEEDED");
        assert.ok(recovered.qr_id);
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
});
