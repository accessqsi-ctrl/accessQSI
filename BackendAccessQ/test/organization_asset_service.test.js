const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");

const loadService = ({ asset = { id: 5, org_id: 42, url: "/card-backgrounds/background_42_a.png" }, usages = [0, 0], count = 0 } = {}) => {
    clearSrcModules();
    const calls = [];
    const counts = [...usages];
    mockModule("src/prisma/client", {
        organizationAsset: {
            findFirst: async ({ where }) => (where.org_id === asset.org_id && where.id === asset.id ? asset : null),
            count: async () => count,
            delete: async ({ where }) => { calls.push(["delete", where.id]); return asset; },
            upsert: async ({ create }) => ({ id: 9, created_at: new Date(), ...create })
        },
        $queryRaw: async () => [{ count: counts.shift() }]
    });
    mockModule("src/services/storage.service", {
        removeManagedPublicAsset: async (url, directory) => {
            calls.push(["remove", url, directory]);
            return directory === "card-backgrounds";
        }
    });
    return { service: require("../src/services/organization_asset.service"), calls };
};

test("an unused library image is deleted with its file", async () => {
    const { service, calls } = loadService();
    await service.deleteForOrg(42, 5);
    assert.deepEqual(calls, [
        ["delete", 5],
        ["remove", "/card-backgrounds/background_42_a.png", "card-backgrounds"]
    ]);
});

test("an image still used by templates or issued cards cannot be deleted", async () => {
    const { service, calls } = loadService({ usages: [2, 3] });
    await assert.rejects(service.deleteForOrg(42, 5), (error) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /2 modèles et 3 cartes déjà émises/);
        return true;
    });
    assert.deepEqual(calls, []);
});

test("images of another organization are not reachable", async () => {
    const { service } = loadService();
    await assert.rejects(service.deleteForOrg(7, 5), error => error.statusCode === 404);
    await assert.rejects(service.updateForOrg(7, 5, { name: "x" }), error => error.statusCode === 404);
});

test("the library enforces its capacity and normalizes kinds and names", async () => {
    const full = loadService({ count: 200 });
    await assert.rejects(full.service.assertCapacity(42), error => error.statusCode === 409);

    const { service } = loadService();
    const asset = await service.registerForOrg(42, { url: "/card-logos/logo_42_b.png", name: "  ", kind: "script" });
    assert.equal(asset.kind, "image");
    assert.equal(asset.name, "Image");
});
