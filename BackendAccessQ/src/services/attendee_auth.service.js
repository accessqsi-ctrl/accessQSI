// Comptes participants : connexion par code email à usage unique, mot de passe facultatif et sessions dédiées.
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");
const emailService = require("./email.service");
const { getPrivateKey } = require("../config/jwtKeys");
const { getSessionCookieOptions } = require("../config/security");
const { pm, emailPattern, passwordPolicyMessage, BCRYPT_SALT_ROUNDS, normalizeEmail } = require("../utils/account");

class AttendeeAuthError extends Error {
    constructor(message, code, statusCode = 400) {
        super(message);
        this.name = "AttendeeAuthError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL_S = 15 * 60;
const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;
const ACCESS_COOKIE = "attendeeToken";
const REFRESH_COOKIE = "attendeeRefreshToken";

const clean = (value, max) => String(value || "").trim().slice(0, max);
// Le code est lié à l'adresse : une empreinte volée ne vaut pas pour un autre compte.
const hashCode = (email, code) => crypto.createHash("sha256").update(`${email}:${code}`).digest("hex");
const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
const sameHash = (left, right) => left.length === right.length && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));

const validEmail = value => {
    const email = normalizeEmail(value);
    if (!emailPattern.test(email) || email.length > 320) {
        throw new AttendeeAuthError("Adresse email invalide.", "INVALID_EMAIL", 422);
    }
    return email;
};

const serializeAttendee = attendee => ({
    id: attendee.attendee_id,
    email: attendee.email,
    fullName: attendee.full_name,
    phone: attendee.phone,
    hasPassword: Boolean(attendee.password_hash)
});

const requestLoginCode = async (emailValue, now = new Date()) => {
    const email = validEmail(emailValue);
    const latest = await prisma.attendeeLoginCode.findFirst({ where: { email }, orderBy: { created_at: "desc" } });
    if (latest && now - latest.created_at < CODE_RESEND_COOLDOWN_MS) {
        throw new AttendeeAuthError("Un code vient d’être envoyé. Patientez une minute avant d’en demander un autre.", "CODE_COOLDOWN", 429);
    }
    const code = newCode();
    await prisma.$transaction([
        prisma.attendeeLoginCode.updateMany({ where: { email, consumed_at: null }, data: { consumed_at: now } }),
        prisma.attendeeLoginCode.create({ data: { email, code_hash: hashCode(email, code), created_at: now, expires_at: new Date(now.getTime() + CODE_TTL_MS) } })
    ]);
    const attendee = await prisma.attendee.findUnique({ where: { email } });
    await emailService.sendAttendeeLoginCode({ toEmail: email, fullName: attendee?.full_name, code, ttlMinutes: CODE_TTL_MS / 60_000 });
    return { expiresInSeconds: CODE_TTL_MS / 1000 };
};

const verifyLoginCode = async ({ email: emailValue, code: codeValue, fullName: fullNameValue }, now = new Date()) => {
    const email = validEmail(emailValue);
    const code = clean(codeValue, 6);
    const fullName = clean(fullNameValue, 160);
    if (!/^\d{6}$/.test(code)) throw new AttendeeAuthError("Le code contient 6 chiffres.", "INVALID_CODE", 422);

    const pending = await prisma.attendeeLoginCode.findFirst({
        where: { email, consumed_at: null, expires_at: { gt: now } },
        orderBy: { created_at: "desc" }
    });
    if (!pending) throw new AttendeeAuthError("Code expiré. Demandez-en un nouveau.", "CODE_EXPIRED", 401);
    // L'incrément conditionnel borne les essais même sous requêtes concurrentes.
    const counted = await prisma.attendeeLoginCode.updateMany({
        where: { attendee_login_code_id: pending.attendee_login_code_id, consumed_at: null, attempts: { lt: CODE_MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } }
    });
    if (!counted.count) throw new AttendeeAuthError("Trop d’essais. Demandez un nouveau code.", "CODE_LOCKED", 429);
    if (!sameHash(pending.code_hash, hashCode(email, code))) throw new AttendeeAuthError("Code incorrect.", "INVALID_CODE", 401);

    const existing = await prisma.attendee.findUnique({ where: { email } });
    // Le code reste valide : le participant complète son nom puis renvoie le même code.
    if (!existing && !fullName) throw new AttendeeAuthError("Indiquez votre nom pour créer votre box.", "NAME_REQUIRED", 422);
    if (existing && !existing.is_active) throw new AttendeeAuthError("Ce compte est désactivé.", "ACCOUNT_DISABLED", 403);

    return prisma.$transaction(async tx => {
        const consumed = await tx.attendeeLoginCode.updateMany({
            where: { attendee_login_code_id: pending.attendee_login_code_id, consumed_at: null },
            data: { consumed_at: now }
        });
        if (!consumed.count) throw new AttendeeAuthError("Code déjà utilisé. Demandez-en un nouveau.", "CODE_EXPIRED", 401);
        const attendee = await tx.attendee.upsert({
            where: { email },
            create: { email, full_name: fullName, email_verified_at: now, last_login: now },
            update: { email_verified_at: existing?.email_verified_at || now, last_login: now }
        });
        return { attendee, created: !existing };
    });
};

const loginWithPassword = async ({ email: emailValue, password }) => {
    const email = validEmail(emailValue);
    const attendee = await prisma.attendee.findUnique({ where: { email } });
    const valid = Boolean(attendee?.password_hash && typeof password === "string" && await bcrypt.compare(password, attendee.password_hash));
    if (!valid) throw new AttendeeAuthError("Adresse email ou mot de passe incorrect.", "INVALID_CREDENTIALS", 401);
    if (!attendee.is_active) throw new AttendeeAuthError("Ce compte est désactivé.", "ACCOUNT_DISABLED", 403);
    return prisma.attendee.update({ where: { attendee_id: attendee.attendee_id }, data: { last_login: new Date() } });
};

const setPassword = async (attendeeId, { currentPassword, newPassword }) => {
    const attendee = await prisma.attendee.findUnique({ where: { attendee_id: attendeeId } });
    if (!attendee) throw new AttendeeAuthError("Compte introuvable.", "ATTENDEE_NOT_FOUND", 404);
    if (typeof newPassword !== "string" || !pm.validate(newPassword)) {
        throw new AttendeeAuthError(passwordPolicyMessage, "WEAK_PASSWORD", 422);
    }
    if (attendee.password_hash) {
        const valid = typeof currentPassword === "string" && await bcrypt.compare(currentPassword, attendee.password_hash);
        if (!valid) throw new AttendeeAuthError("Mot de passe actuel incorrect.", "INVALID_CREDENTIALS", 401);
    }
    return prisma.attendee.update({
        where: { attendee_id: attendeeId },
        data: {
            password_hash: await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS),
            // Un changement de mot de passe ferme les autres sessions ; la première sécurisation non.
            ...(attendee.password_hash ? { session_version: { increment: 1 } } : {})
        }
    });
};

const tokenPayload = (attendee, tokenType) => ({
    attendee_id: attendee.attendee_id,
    session_version: Number(attendee.session_version || 0),
    token_type: tokenType
});

const cookieBase = () => ({ ...getSessionCookieOptions(), path: "/" });

const issueSession = (res, attendee) => {
    const sign = (type, expiresIn) => jwt.sign(tokenPayload(attendee, type), getPrivateKey(), { expiresIn, algorithm: "RS256" });
    const accessToken = sign("attendee_access", ACCESS_TOKEN_TTL_S);
    const refreshToken = sign("attendee_refresh", REFRESH_TOKEN_TTL_S);
    res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(), maxAge: ACCESS_TOKEN_TTL_S * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(), maxAge: REFRESH_TOKEN_TTL_S * 1000 });
    return { accessToken };
};

const clearSession = res => {
    res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), maxAge: 0 });
    res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), maxAge: 0 });
};

// Renvoie le participant si la session est toujours valide (compte actif, version de session à jour).
const resolveSessionAttendee = async decoded => {
    if (!decoded?.attendee_id) return null;
    const attendee = await prisma.attendee.findUnique({ where: { attendee_id: decoded.attendee_id } });
    if (!attendee || !attendee.is_active || attendee.session_version !== Number(decoded.session_version || 0)) return null;
    return attendee;
};

module.exports = {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    AttendeeAuthError,
    CODE_MAX_ATTEMPTS,
    clearSession,
    hashCode,
    issueSession,
    loginWithPassword,
    requestLoginCode,
    resolveSessionAttendee,
    serializeAttendee,
    setPassword,
    verifyLoginCode
};
