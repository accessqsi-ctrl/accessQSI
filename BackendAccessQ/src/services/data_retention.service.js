// Purge automatique des données personnelles, selon les durées annoncées dans la politique de
// confidentialité (frontendAccessQ/src/app/confidentialite/page.jsx). Changer une durée ici
// impose de mettre le texte à jour, et inversement.
//
// Date de référence d'un QR code (« fin de l'événement ») : la plus tardive entre la fin du
// dernier créneau de l'événement et la fin de validité du QR. Un badge sans aucune date de fin
// (badge permanent, carte d'élève) est jugé sur sa dernière activité : on ne purge donc jamais
// un badge encore utilisé.
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION = Object.freeze({
    holderPhotoDays: 183,     // 6 mois après la fin de l'événement
    scanLogDays: 365,         // 1 an après l'événement
    inactiveAttendeeDays: 1095, // 3 ans sans activité sur la box
    loginCodeDays: 1          // codes valables 10 minutes : inutiles au-delà
});
const MODES = Object.freeze(["off", "dry-run", "on"]);
const ANONYMIZED_EMAIL_DOMAIN = "anonyme.invalid";
const BATCH_SIZE = 500;
// Borne le travail d'un passage ; le reste est traité au passage suivant.
const MAX_BATCHES_PER_RUN = 40;

// Par défaut, la purge simule : elle compte sans supprimer tant que DATA_RETENTION_MODE n'est pas « on ».
const getRetentionConfig = (env = process.env) => {
    const mode = String(env.DATA_RETENTION_MODE || "dry-run").trim().toLowerCase();
    const interval = Number.parseInt(env.DATA_RETENTION_INTERVAL_MS || "", 10);
    return {
        mode: MODES.includes(mode) ? mode : "dry-run",
        intervalMs: Number.isInteger(interval) && interval >= 60_000 ? interval : 6 * 60 * 60 * 1000
    };
};

const cutoff = (now, days) => new Date(now.getTime() - days * DAY_MS);

const eventEnds = Prisma.sql`SELECT "id_event", MAX("end_date") AS "ends_at" FROM "EventSchedule" GROUP BY "id_event"`;

// Chaque règle décrit les lignes à traiter (requête renvoyant « id ») et l'action à appliquer
// à un lot, donné sous forme de sous-requête : les identifiants ne quittent pas la base.
const rules = now => [
    {
        name: "holder_photos",
        candidates: Prisma.sql`
            SELECT p."qr_id" AS "id"
            FROM "qr_holder_photos" p
            JOIN "qr_codes" q ON q."qr_id" = p."qr_id"
            LEFT JOIN (${eventEnds}) e ON e."id_event" = q."event_id"
            WHERE COALESCE(GREATEST(e."ends_at", q."valid_until"), GREATEST(q."updated_at", p."updated_at"))
                  < ${cutoff(now, RETENTION.holderPhotoDays)}`,
        apply: batch => Prisma.sql`DELETE FROM "qr_holder_photos" WHERE "qr_id" IN (${batch})`
    },
    {
        name: "scan_logs",
        candidates: Prisma.sql`
            SELECT s."id" AS "id"
            FROM "scan_logs" s
            JOIN "qr_codes" q ON q."qr_id" = s."qr_code_id"
            LEFT JOIN (${eventEnds}) e ON e."id_event" = q."event_id"
            WHERE s."scanned_at" < ${cutoff(now, RETENTION.scanLogDays)}
              AND COALESCE(GREATEST(e."ends_at", q."valid_until"), s."scanned_at") < ${cutoff(now, RETENTION.scanLogDays)}`,
        apply: batch => Prisma.sql`DELETE FROM "scan_logs" WHERE "id" IN (${batch})`
    },
    {
        // Le compte n'est pas supprimé : ses paiements doivent être gardés pour la comptabilité.
        // On efface ce qui identifie la personne et on ferme définitivement la box.
        name: "inactive_attendees",
        candidates: Prisma.sql`
            SELECT a."attendee_id" AS "id"
            FROM "attendees" a
            WHERE a."email" NOT LIKE ${`%@${ANONYMIZED_EMAIL_DOMAIN}`}
              AND GREATEST(
                    a."created_at",
                    a."last_login",
                    (SELECT MAX(r."created_at") FROM "registrations" r WHERE r."owner_attendee_id" = a."attendee_id"),
                    (SELECT MAX(t."created_at") FROM "ticket_payments" t WHERE t."attendee_id" = a."attendee_id")
                  ) < ${cutoff(now, RETENTION.inactiveAttendeeDays)}`,
        apply: batch => Prisma.sql`
            UPDATE "attendees" SET
                "email" = 'supprime-' || "attendee_id"::text || ${`@${ANONYMIZED_EMAIL_DOMAIN}`},
                "full_name" = 'Compte supprimé',
                "phone" = NULL,
                "password_hash" = NULL,
                "is_active" = false,
                "session_version" = "session_version" + 1,
                "updated_at" = ${now}
            WHERE "attendee_id" IN (${batch})`
    },
    {
        name: "attendee_login_codes",
        candidates: Prisma.sql`
            SELECT c."attendee_login_code_id" AS "id"
            FROM "attendee_login_codes" c
            WHERE c."created_at" < ${cutoff(now, RETENTION.loginCodeDays)}`,
        apply: batch => Prisma.sql`DELETE FROM "attendee_login_codes" WHERE "attendee_login_code_id" IN (${batch})`
    }
];

const countRule = async (db, rule) => {
    const [row] = await db.$queryRaw`SELECT COUNT(*)::int AS "count" FROM (${rule.candidates}) candidates`;
    return row?.count ?? 0;
};

const applyRule = async (db, rule) => {
    let total = 0;
    const batch = Prisma.sql`SELECT candidates."id" FROM (${rule.candidates} LIMIT ${BATCH_SIZE}) candidates`;
    for (let round = 0; round < MAX_BATCHES_PER_RUN; round += 1) {
        const affected = await db.$executeRaw(rule.apply(batch));
        total += affected;
        if (affected < BATCH_SIZE) break;
    }
    return total;
};

// Renvoie, par règle, le nombre de lignes traitées (mode « on ») ou qui le seraient (« dry-run »).
const runRetention = async ({ mode = getRetentionConfig().mode, now = new Date(), db = prisma } = {}) => {
    if (mode === "off") return { mode, results: {} };
    const results = {};
    for (const rule of rules(now)) {
        results[rule.name] = mode === "on" ? await applyRule(db, rule) : await countRule(db, rule);
    }
    return { mode, results };
};

module.exports = { ANONYMIZED_EMAIL_DOMAIN, MODES, RETENTION, getRetentionConfig, runRetention };
