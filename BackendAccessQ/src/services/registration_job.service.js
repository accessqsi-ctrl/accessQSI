const os = require("os");
const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");

const workerId = () => `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString("hex")}`;
const errorText = error => String(error?.message || error || "Erreur inconnue").slice(0, 500);
const backoffMs = attempts => Math.min(15 * 60_000, 2 ** Math.max(0, attempts - 1) * 5_000);

const enqueue = async (registrationId, type, dbClient = prisma, options = {}) => {
    const existing = await dbClient.registrationJob.findFirst({
        where: { registration_id: registrationId, type, status: { in: ["PENDING", "PROCESSING"] } },
        orderBy: { created_at: "desc" }
    });
    if (existing) return existing;
    try {
        return await dbClient.registrationJob.create({
            data: {
                registration_id: registrationId,
                type,
                max_attempts: options.maxAttempts || 6,
                run_after: options.runAfter || new Date()
            }
        });
    } catch (error) {
        if (error?.code !== "P2002") throw error;
        return null;
    }
};

const claimNext = async ({ id, leaseMs = 60_000 } = {}) => {
    const lockedBy = id || workerId();
    const rows = await prisma.$queryRaw(Prisma.sql`
        WITH candidate AS (
            SELECT registration_job_id
            FROM registration_jobs
            WHERE run_after <= NOW()
              AND (
                status = 'PENDING'::"RegistrationJobStatus"
                OR (status = 'PROCESSING'::"RegistrationJobStatus" AND lease_until < NOW())
              )
            ORDER BY run_after ASC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE registration_jobs AS job
        SET status = 'PROCESSING'::"RegistrationJobStatus",
            attempts = job.attempts + 1,
            locked_by = ${lockedBy},
            lease_until = NOW() + (${leaseMs}::text || ' milliseconds')::interval,
            updated_at = NOW()
        FROM candidate
        WHERE job.registration_job_id = candidate.registration_job_id
        RETURNING job.*
    `);
    return rows[0] || null;
};

const complete = (job, dbClient = prisma) => dbClient.registrationJob.updateMany({
    where: { registration_job_id: job.registration_job_id, status: "PROCESSING", locked_by: job.locked_by },
    data: { status: "COMPLETED", completed_at: new Date(), lease_until: null, locked_by: null, last_error: null }
});

const fail = async (job, error, options = {}, dbClient = prisma) => {
    const terminal = Boolean(options.terminal) || job.attempts >= job.max_attempts;
    return dbClient.registrationJob.updateMany({
        where: { registration_job_id: job.registration_job_id, status: "PROCESSING", locked_by: job.locked_by },
        data: terminal ? {
            status: "FAILED",
            lease_until: null,
            locked_by: null,
            last_error: errorText(error)
        } : {
            status: "PENDING",
            run_after: new Date(Date.now() + backoffMs(job.attempts)),
            lease_until: null,
            locked_by: null,
            last_error: errorText(error)
        }
    });
};

module.exports = { backoffMs, claimNext, complete, enqueue, errorText, fail, workerId };
