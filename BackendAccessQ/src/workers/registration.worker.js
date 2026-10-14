require("dotenv").config();
const prisma = require("../prisma/client");
const logger = require("../utils/logger");
const passIssuanceService = require("../services/pass_issuance.service");
const emailService = require("../services/email.service");
const jobService = require("../services/registration_job.service");
const { createAccessToken, hashToken } = require("../services/registration_access.service");

const workerName = jobService.workerId();
const pollMs = Math.max(250, Number(process.env.REGISTRATION_WORKER_POLL_MS) || 2_000);
const leaseMs = Math.max(10_000, Number(process.env.REGISTRATION_JOB_LEASE_MS) || 60_000);
const jobMeta = (job, stage) => ({
    stage,
    worker: workerName,
    job_id: job.registration_job_id,
    job_type: job.type,
    registration_id: job.registration_id,
    attempt: job.attempts,
    max_attempts: job.max_attempts
});

const releaseFailedRegistration = async (registrationId, issuanceStatus, error) => {
    await prisma.registration.update({
        where: { registration_id: registrationId },
        data: {
            status: "FAILED",
            issuance_status: issuanceStatus,
            capacity_held: false,
            capacity_released_at: new Date(),
            failure_code: String(error?.code || "PASS_ISSUANCE_FAILED").slice(0, 80),
            failure_message: jobService.errorText(error)
        }
    });
};

const processIssuePass = async job => {
    const registration = await prisma.registration.findUnique({ where: { registration_id: job.registration_id } });
    if (!registration) {
        logger.warn("registration_job.skipped", { ...jobMeta(job, "load_registration"), reason: "registration_not_found" });
        return jobService.complete(job);
    }
    if (registration.qr_id && registration.issuance_status === "SUCCEEDED") {
        logger.info("registration_job.idempotent_replay", { ...jobMeta(job, "issue_pass"), qr_id: registration.qr_id, action: "email_job_ensured" });
        await jobService.enqueue(registration.registration_id, "SEND_PASS_EMAIL");
        return jobService.complete(job);
    }
    logger.info("registration_job.started", { ...jobMeta(job, "issue_pass"), org_id: registration.org_id, event_id: registration.event_id });
    await prisma.registration.update({ where: { registration_id: registration.registration_id }, data: { issuance_status: "PROCESSING" } });
    const offer = registration.offer_snapshot;
    try {
        const result = await passIssuanceService.issuePass({
            organizationId: registration.org_id,
            eventId: registration.event_id,
            input: {
                fullName: registration.holder_name,
                email: registration.holder_email,
                phone: registration.holder_phone || "",
                accessType: offer.accessType,
                limit: offer.usageLimit,
                level: offer.level,
                validFrom: offer.validFrom,
                validUntil: offer.validUntil,
                cardTemplateId: offer.cardTemplateId || "event-ticket",
                cardMessage: offer.cardMessage || ""
            },
            trustedTemplateSnapshot: offer.cardTemplateSnapshot,
            idempotency: { scope: `registration:${registration.registration_id}`, key: registration.registration_id }
        });
        await prisma.$transaction(async tx => {
            await tx.registration.update({
                where: { registration_id: registration.registration_id },
                data: { qr_id: result.qrRecord.qr_id, status: "COMPLETED", issuance_status: "SUCCEEDED", completed_at: new Date(), failure_code: null, failure_message: null }
            });
            await jobService.enqueue(registration.registration_id, "SEND_PASS_EMAIL", tx);
        });
        const completed = await jobService.complete(job);
        logger.info("registration_job.completed", { ...jobMeta(job, "issue_pass"), org_id: registration.org_id, event_id: registration.event_id, qr_id: result.qrRecord.qr_id });
        return completed;
    } catch (error) {
        if (error?.code === "PLAN_QUOTA_EXCEEDED" || error?.code === "EVENT_PASS_EXPIRED") {
            await releaseFailedRegistration(registration.registration_id, "BLOCKED_QUOTA", error);
            await jobService.fail(job, error, { terminal: true });
            logger.warn("registration_job.blocked", { ...jobMeta(job, "issue_pass"), org_id: registration.org_id, event_id: registration.event_id, code: error.code, reason: error.message });
            return;
        }
        const terminal = job.attempts >= job.max_attempts;
        if (terminal) await releaseFailedRegistration(registration.registration_id, "FAILED", error);
        else await prisma.registration.update({ where: { registration_id: registration.registration_id }, data: { issuance_status: "PENDING", failure_code: String(error?.code || "TEMPORARY_ERROR").slice(0, 80), failure_message: jobService.errorText(error) } });
        await jobService.fail(job, error, { terminal });
        if (terminal) {
            logger.error("registration_job.failed", { ...jobMeta(job, "issue_pass"), org_id: registration.org_id, event_id: registration.event_id, error });
        } else {
            logger.warn("registration_job.retry_scheduled", { ...jobMeta(job, "issue_pass"), org_id: registration.org_id, event_id: registration.event_id, code: error?.code || "TEMPORARY_ERROR", reason: jobService.errorText(error), retry_in_ms: jobService.backoffMs(job.attempts) });
        }
    }
};

const processEmail = async job => {
    const registration = await prisma.registration.findUnique({
        where: { registration_id: job.registration_id },
        include: { event: true, offer: true }
    });
    if (!registration || registration.issuance_status !== "SUCCEEDED") {
        const reason = !registration ? "registration_not_found" : "pass_not_available";
        logger.warn("registration_job.blocked", { ...jobMeta(job, "send_pass_email"), reason, issuance_status: registration?.issuance_status });
        return jobService.fail(job, new Error("Pass indisponible pour l’email."), { terminal: true });
    }
    logger.info("registration_job.started", { ...jobMeta(job, "send_pass_email"), org_id: registration.org_id, event_id: registration.event_id });
    const delivery = await prisma.registrationEmailDelivery.create({ data: { registration_id: registration.registration_id } });
    let token;
    try {
        token = await createAccessToken(registration.registration_id);
        const frontend = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
        const accessUrl = `${frontend}/register/access?token=${encodeURIComponent(token.rawToken)}`;
        const response = await emailService.sendPassAccessEmail({
            toEmail: registration.holder_email,
            fullName: registration.holder_name,
            eventTitle: registration.event.title,
            offerName: registration.offer.name,
            accessUrl
        });
        await prisma.$transaction([
            prisma.registrationEmailDelivery.update({ where: { registration_email_delivery_id: delivery.registration_email_delivery_id }, data: { status: "ACCEPTED", provider_message_id: response?.messageId ? String(response.messageId).slice(0, 200) : null, accepted_at: new Date() } }),
            prisma.registration.update({ where: { registration_id: registration.registration_id }, data: { email_status: "ACCEPTED" } })
        ]);
        const completed = await jobService.complete(job);
        logger.info("registration_job.completed", { ...jobMeta(job, "send_pass_email"), org_id: registration.org_id, event_id: registration.event_id, delivery_id: delivery.registration_email_delivery_id, provider_message_id: response?.messageId ? String(response.messageId).slice(0, 200) : undefined });
        return completed;
    } catch (error) {
        if (token?.rawToken) {
            await prisma.registrationAccessToken.updateMany({
                where: { token_hash: hashToken(token.rawToken), revoked_at: null },
                data: { revoked_at: new Date() }
            });
        }
        const terminal = job.attempts >= job.max_attempts;
        await prisma.registrationEmailDelivery.update({ where: { registration_email_delivery_id: delivery.registration_email_delivery_id }, data: { status: "FAILED", failure_message: jobService.errorText(error) } });
        await prisma.registration.update({ where: { registration_id: registration.registration_id }, data: { email_status: terminal ? "FAILED" : "PENDING" } });
        const failed = await jobService.fail(job, error, { terminal });
        if (terminal) {
            logger.error("registration_job.failed", { ...jobMeta(job, "send_pass_email"), org_id: registration.org_id, event_id: registration.event_id, delivery_id: delivery.registration_email_delivery_id, error });
        } else {
            logger.warn("registration_job.retry_scheduled", { ...jobMeta(job, "send_pass_email"), org_id: registration.org_id, event_id: registration.event_id, delivery_id: delivery.registration_email_delivery_id, code: error?.code || "EMAIL_DELIVERY_FAILED", reason: jobService.errorText(error), retry_in_ms: jobService.backoffMs(job.attempts) });
        }
        return failed;
    }
};

const processOne = async () => {
    const job = await jobService.claimNext({ id: workerName, leaseMs });
    if (!job) return false;
    if (job.type === "ISSUE_PASS") await processIssuePass(job);
    else if (job.type === "SEND_PASS_EMAIL") await processEmail(job);
    else {
        const error = new Error("Type de job inconnu.");
        error.code = "UNKNOWN_REGISTRATION_JOB_TYPE";
        await jobService.fail(job, error, { terminal: true });
        logger.error("registration_job.failed", { ...jobMeta(job, "dispatch"), error });
    }
    return true;
};

const run = async () => {
    logger.info("registration_worker.started", { worker: workerName, poll_ms: pollMs, lease_ms: leaseMs });
    while (true) {
        try {
            const processed = await processOne();
            if (!processed) await new Promise(resolve => setTimeout(resolve, pollMs));
        } catch (error) {
            logger.error("registration_worker.iteration_failed", { worker: workerName, poll_ms: pollMs, error });
            await new Promise(resolve => setTimeout(resolve, pollMs));
        }
    }
};

if (require.main === module) run();

module.exports = { processEmail, processIssuePass, processOne, releaseFailedRegistration, run };
