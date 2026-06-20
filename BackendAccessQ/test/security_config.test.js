const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getAllowedOrigins,
    getSessionCookieOptions,
    isOriginAllowed
} = require("../src/config/security");

test("security config builds allowed origins from frontend, admin and extra CORS origins", () => {
    const origins = getAllowedOrigins({
        FRONTEND_URL: "https://app.example.com",
        ADMIN_URL: "https://admin.example.com",
        CORS_ORIGINS: "https://scan.example.com, https://kiosk.example.com"
    });

    assert.deepEqual(origins, [
        "https://app.example.com",
        "https://admin.example.com",
        "https://scan.example.com",
        "https://kiosk.example.com"
    ]);
    assert.equal(isOriginAllowed("https://app.example.com", origins), true);
    assert.equal(isOriginAllowed("https://unknown.example.com", origins), false);
    assert.equal(isOriginAllowed(undefined, origins), true);
});

test("session cookies default to HTTPS SameSite=None in production", () => {
    const options = getSessionCookieOptions({ NODE_ENV: "production" });

    assert.deepEqual(options, {
        httpOnly: true,
        secure: true,
        sameSite: "none"
    });
});

test("session cookies can stay lax and insecure in local development", () => {
    const options = getSessionCookieOptions({
        NODE_ENV: "development",
        COOKIE_SAMESITE: "lax",
        COOKIE_SECURE: "false"
    });

    assert.deepEqual(options, {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    });
});
