const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { clearSrcModules } = require("./helpers/http");

// Démarre la vraie application sur un stockage temporaire pour vérifier ce qui est servi statiquement.
const withApp = async (files, callback) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "accessq-static-"));
    const previous = process.env.FILE_STORAGE_ROOT;
    try {
        fs.mkdirSync(path.join(root, "card-logos"));
        for (const [name, content] of Object.entries(files)) {
            fs.writeFileSync(path.join(root, "card-logos", name), content);
        }
        process.env.FILE_STORAGE_ROOT = root;
        clearSrcModules();
        const app = require("../src/app");
        const server = app.listen(0);
        await new Promise(resolve => server.once("listening", resolve));
        try {
            await callback(`http://127.0.0.1:${server.address().port}`);
        } finally {
            await new Promise(resolve => server.close(resolve));
        }
    } finally {
        if (previous === undefined) delete process.env.FILE_STORAGE_ROOT;
        else process.env.FILE_STORAGE_ROOT = previous;
        fs.rmSync(root, { recursive: true, force: true });
        clearSrcModules();
    }
};

test("only image files are served from template storage", async () => {
    await withApp({
        "logo_1.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        "logo_1.html": "<script>alert(1)</script>",
        "logo_1.js": "alert(1)"
    }, async (baseUrl) => {
        const image = await fetch(`${baseUrl}/card-logos/logo_1.png`);
        assert.equal(image.status, 200);
        assert.equal(image.headers.get("content-type"), "image/png");

        for (const name of ["logo_1.html", "logo_1.js"]) {
            const response = await fetch(`${baseUrl}/card-logos/${name}`);
            assert.equal(response.status, 404, name);
            assert.doesNotMatch(await response.text(), /alert/);
        }
    });
});

test("legacy SVG logos are served sandboxed so their scripts never run", async () => {
    await withApp({
        "logo_2.svg": "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"
    }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/card-logos/logo_2.svg`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-security-policy"), /sandbox/);
        assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
    });
});
