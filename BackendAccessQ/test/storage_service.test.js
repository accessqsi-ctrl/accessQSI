const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockPackage } = require("./helpers/http");

const envKeys = [
    "STORAGE_DRIVER",
    "NODE_ENV",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_URL",
    "FILE_STORAGE_ROOT"
];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

test("R2 storage uploads, materializes and deletes a managed background", async () => {
    const sent = [];

    class S3Client {
        constructor(options) { this.options = options; }
        async send(command) {
            sent.push(command);
            if (command instanceof GetObjectCommand) return { ContentType: "image/png", Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) } };
            return {};
        }
    }
    class PutObjectCommand { constructor(input) { this.input = input; } }
    class GetObjectCommand { constructor(input) { this.input = input; } }
    class DeleteObjectCommand { constructor(input) { this.input = input; } }

    Object.assign(process.env, {
        STORAGE_DRIVER: "r2",
        NODE_ENV: "production",
        R2_ACCOUNT_ID: "account-id",
        R2_ACCESS_KEY_ID: "access-key",
        R2_SECRET_ACCESS_KEY: "secret-key",
        R2_BUCKET: "accessq-assets",
        R2_PUBLIC_URL: "https://assets.example.com"
    });
    delete process.env.FILE_STORAGE_ROOT;

    clearSrcModules();
    mockPackage("@aws-sdk/client-s3", { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand });

    const storageService = require("../src/services/storage.service");
    storageService.assertPersistentStorageConfigured();

    const publicUrl = await storageService.saveUploadedAsset({
        directory: "card-backgrounds",
        filename: "background_42_test.png",
        contentType: "image/png",
        buffer: Buffer.from([1, 2, 3])
    });
    assert.equal(publicUrl, "https://assets.example.com/card-backgrounds/background_42_test.png");
    assert.deepEqual(sent[0].input, { Bucket: "accessq-assets", Key: "card-backgrounds/background_42_test.png", Body: Buffer.from([1, 2, 3]), ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" });

    const materialized = await storageService.materializeManagedAsset(publicUrl);
    assert.equal(materialized, "data:image/png;base64,AQID");

    const removed = await storageService.removeManagedPublicAsset(publicUrl, "card-backgrounds");
    assert.equal(removed, true);
    assert.equal(sent.length, 3);
    assert.ok(sent[2] instanceof DeleteObjectCommand);
});
