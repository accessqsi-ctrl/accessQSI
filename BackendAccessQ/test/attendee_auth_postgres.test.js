const test = require("node:test");
const assert = require("node:assert/strict");

const enabled = process.env.ACCESSQ_POSTGRES_INTEGRATION === "1";
const safeDatabase = (() => {
    try { return new URL(process.env.DATABASE_URL || "").pathname.includes("accessq_v1_test"); }
    catch { return false; }
})();

test("attendee email-code login and box password on PostgreSQL", { skip: !enabled || !safeDatabase }, async t => {
    const prisma = require("../src/prisma/client");
    const emailService = require("../src/services/email.service");
    const auth = require("../src/services/attendee_auth.service");

    const sent = [];
    emailService.sendAttendeeLoginCode = async message => { sent.push(message); return { messageId: "test" }; };
    const cleanup = async () => {
        await prisma.attendeeLoginCode.deleteMany({ where: { email: { endsWith: "@box.test" } } });
        await prisma.attendee.deleteMany({ where: { email: { endsWith: "@box.test" } } });
    };
    await cleanup();
    t.after(async () => { await cleanup(); await prisma.$disconnect(); });

    await t.test("a new attendee needs a name, then the same code creates the box", async () => {
        await auth.requestLoginCode("New@Box.test");
        const { code } = sent.at(-1);
        assert.match(code, /^\d{6}$/);
        const stored = await prisma.attendeeLoginCode.findFirst({ where: { email: "new@box.test" } });
        assert.notEqual(stored.code_hash, code);

        await assert.rejects(auth.verifyLoginCode({ email: "new@box.test", code }), error => error.code === "NAME_REQUIRED");
        await assert.rejects(auth.verifyLoginCode({ email: "new@box.test", code, fullName: "New Attendee" }), error => error.code === "TERMS_REQUIRED");
        const { attendee, created } = await auth.verifyLoginCode({ email: "new@box.test", code, fullName: "New Attendee", acceptTerms: true });
        assert.equal(created, true);
        assert.equal(attendee.terms_version, require("../src/config/legal").TERMS_VERSION);
        assert.ok(attendee.terms_accepted_at);
        assert.equal(attendee.full_name, "New Attendee");
        assert.ok(attendee.email_verified_at);
        await assert.rejects(auth.verifyLoginCode({ email: "new@box.test", code }), error => error.code === "CODE_EXPIRED");
    });

    await t.test("resend cooldown, wrong codes and lockout", async () => {
        const later = new Date(Date.now() + 2 * 60_000);
        await auth.requestLoginCode("new@box.test", later);
        await assert.rejects(auth.requestLoginCode("new@box.test", later), error => error.code === "CODE_COOLDOWN");
        const { code } = sent.at(-1);
        const wrong = code === "000000" ? "111111" : "000000";
        for (let attempt = 1; attempt <= auth.CODE_MAX_ATTEMPTS; attempt += 1) {
            await assert.rejects(auth.verifyLoginCode({ email: "new@box.test", code: wrong }), error => error.code === "INVALID_CODE");
        }
        await assert.rejects(auth.verifyLoginCode({ email: "new@box.test", code }), error => error.code === "CODE_LOCKED");
    });

    await t.test("securing the box enables password login", async () => {
        const attendee = await prisma.attendee.findUnique({ where: { email: "new@box.test" } });
        await assert.rejects(auth.setPassword(attendee.attendee_id, { newPassword: "weak" }), error => error.code === "WEAK_PASSWORD");
        const secured = await auth.setPassword(attendee.attendee_id, { newPassword: "Box-Secure1" });
        assert.equal(secured.session_version, attendee.session_version);
        await assert.rejects(auth.loginWithPassword({ email: "new@box.test", password: "Wrong-Pass1" }), error => error.code === "INVALID_CREDENTIALS");
        assert.equal((await auth.loginWithPassword({ email: "new@box.test", password: "Box-Secure1" })).attendee_id, attendee.attendee_id);

        // Une nouvelle version des conditions doit être acceptée à la connexion suivante.
        await prisma.attendee.update({ where: { attendee_id: attendee.attendee_id }, data: { terms_version: "2000-01-01" } });
        await assert.rejects(auth.loginWithPassword({ email: "new@box.test", password: "Box-Secure1" }), error => error.code === "TERMS_REQUIRED");
        assert.equal((await auth.loginWithPassword({ email: "new@box.test", password: "Box-Secure1", acceptTerms: true })).terms_version, require("../src/config/legal").TERMS_VERSION);

        await assert.rejects(auth.setPassword(attendee.attendee_id, { currentPassword: "Wrong-Pass1", newPassword: "Box-Secure2" }), error => error.code === "INVALID_CREDENTIALS");
        const changed = await auth.setPassword(attendee.attendee_id, { currentPassword: "Box-Secure1", newPassword: "Box-Secure2" });
        assert.equal(changed.session_version, attendee.session_version + 1);
        assert.equal(await auth.resolveSessionAttendee({ attendee_id: attendee.attendee_id, session_version: attendee.session_version }), null);
    });
});
