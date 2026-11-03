// QR tournant des billets « box uniquement » : le QR change toutes les 30 secondes, une capture d'écran
// devient inutilisable dès la période suivante. Le code est un HMAC du jeton et de la période, vérifié au scan.
const crypto = require("crypto");
const { getPrivateKey } = require("../config/jwtKeys");

const STEP_SECONDS = 30;
// La période précédente reste acceptée pour absorber le délai entre l'affichage et le scan.
const ACCEPTED_PAST_STEPS = 1;

let cachedKey = null;
// Clé dérivée de la clé privée JWT : aucune configuration supplémentaire, jamais exposée au client.
const signingKey = () => {
    cachedKey ||= crypto.createHmac("sha256", getPrivateKey().export({ type: "pkcs8", format: "pem" })).update("accessq-box-qr-v1").digest();
    return cachedKey;
};

const stepAt = now => Math.floor(now.getTime() / 1000 / STEP_SECONDS);
const codeFor = (token, step) => crypto.createHmac("sha256", signingKey()).update(`${token}:${step}`).digest("base64url").slice(0, 16);

const buildDynamicPayload = (qr, now = new Date()) => {
    const step = stepAt(now);
    return {
        payload: JSON.stringify({ t: qr.unique_token, e: qr.event_id, s: step, c: codeFor(qr.unique_token, step) }),
        expiresAt: new Date((step + 1) * STEP_SECONDS * 1000)
    };
};

const verifyDynamicCode = (token, step, code, now = new Date()) => {
    const current = stepAt(now);
    const claimed = Number(step);
    if (!Number.isInteger(claimed) || claimed > current || claimed < current - ACCEPTED_PAST_STEPS) return false;
    const expected = Buffer.from(codeFor(String(token), claimed));
    const received = Buffer.from(String(code || ""));
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const requiresDynamicCode = qr => Boolean(qr?.registration?.offer_snapshot?.boxOnlyQr);

module.exports = { STEP_SECONDS, buildDynamicPayload, requiresDynamicCode, verifyDynamicCode };
