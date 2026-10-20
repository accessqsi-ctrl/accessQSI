const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);

const loadController = ({ qr = { qr_id: 8, event_id: 5, deleted_at: null }, ownsEvent = true, photos = {} } = {}) => {
    clearSrcModules();
    const calls = [];
    mockModule("src/prisma/client", {
        qrHolderPhoto: {
            upsert: async ({ where, create }) => {
                calls.push(["upsert", where.qr_id, create.mime_type]);
                return { qr_id: where.qr_id, updated_at: new Date("2026-10-20T10:00:00Z") };
            },
            deleteMany: async ({ where }) => {
                calls.push(["delete", where.qr_id]);
                return { count: 1 };
            },
            findUnique: async ({ where }) => photos[where.qr_id] || null
        }
    });
    mockModule("src/services/qr.service", { getQrById: async () => qr });
    mockModule("src/services/event.service", {
        findById: async (orgId, eventId) => (ownsEvent ? { event_id: eventId, org_id: orgId } : null)
    });
    return { controller: require("../src/controllers/api.qr_photo.controller"), calls };
};

const invoke = async (handler, { id = "8", file } = {}) => {
    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        send(body) { this.body = body; return this; },
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; }
    };
    await handler({ params: { id }, file, user: { user_id: 7, org_id: 42 }, requestId: "req-1" }, res);
    return res;
};

test("photo type is detected from file bytes, not from the declared type", () => {
    clearSrcModules();
    mockModule("src/prisma/client", {});
    const { detectImageType } = require("../src/services/qr_photo.service");
    assert.equal(detectImageType(JPEG), "image/jpeg");
    assert.equal(detectImageType(PNG), "image/png");
    assert.equal(detectImageType(WEBP), "image/webp");
    assert.equal(detectImageType(Buffer.from("<svg onload=alert(1)></svg>")), null);
});

test("PUT /qr/:id/photo stores a JPEG for a QR of the user's organization", async () => {
    const { controller, calls } = loadController();
    const res = await invoke(controller.uploadHolderPhoto, { file: { buffer: JPEG } });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.hasPhoto, true);
    assert.deepEqual(calls, [["upsert", 8, "image/jpeg"]]);
});

test("PUT /qr/:id/photo rejects non-image files and QR codes of another organization", async () => {
    const notImage = loadController();
    const rejected = await invoke(notImage.controller.uploadHolderPhoto, { file: { buffer: Buffer.from("not an image at all") } });
    assert.equal(rejected.statusCode, 415);
    assert.deepEqual(notImage.calls, []);

    const foreign = loadController({ ownsEvent: false });
    const forbidden = await invoke(foreign.controller.uploadHolderPhoto, { file: { buffer: JPEG } });
    assert.equal(forbidden.statusCode, 403);
    assert.deepEqual(foreign.calls, []);

    const missing = loadController();
    const noFile = await invoke(missing.controller.uploadHolderPhoto, {});
    assert.equal(noFile.statusCode, 400);
});

test("GET and DELETE /qr/:id/photo are scoped to the organization", async () => {
    const { controller, calls } = loadController({ photos: { 8: { mime_type: "image/png", data: PNG } } });
    const photo = await invoke(controller.getHolderPhoto);
    assert.equal(photo.statusCode, 200);
    assert.equal(photo.headers["content-type"], "image/png");
    assert.equal(photo.headers["cache-control"], "private, no-store");
    assert.deepEqual(photo.body, PNG);

    const removed = await invoke(controller.deleteHolderPhoto);
    assert.equal(removed.statusCode, 200);
    assert.deepEqual(calls, [["delete", 8]]);

    const foreign = loadController({ ownsEvent: false, photos: { 8: { mime_type: "image/png", data: PNG } } });
    assert.equal((await invoke(foreign.controller.getHolderPhoto)).statusCode, 403);
});
