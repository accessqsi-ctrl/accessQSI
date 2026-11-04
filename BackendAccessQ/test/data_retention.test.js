const test = require("node:test");
const assert = require("node:assert/strict");
const { RETENTION, getRetentionConfig, runRetention } = require("../src/services/data_retention.service");

// Base factice : compte les requêtes de lecture et d'écriture.
const fakeDb = ({ count = 3, affected = [] } = {}) => {
    const calls = { query: 0, execute: 0 };
    const queue = [...affected];
    return {
        calls,
        $queryRaw: async () => { calls.query += 1; return [{ count }]; },
        $executeRaw: async () => { calls.execute += 1; return queue.shift() ?? 0; }
    };
};

test("retention simulates by default and only purges when explicitly enabled", () => {
    assert.equal(getRetentionConfig({}).mode, "dry-run");
    assert.equal(getRetentionConfig({ DATA_RETENTION_MODE: "ON" }).mode, "on");
    assert.equal(getRetentionConfig({ DATA_RETENTION_MODE: "off" }).mode, "off");
    assert.equal(getRetentionConfig({ DATA_RETENTION_MODE: "supprimer" }).mode, "dry-run");
    assert.equal(getRetentionConfig({}).intervalMs, 6 * 60 * 60 * 1000);
    assert.equal(getRetentionConfig({ DATA_RETENTION_INTERVAL_MS: "10" }).intervalMs, 6 * 60 * 60 * 1000);
});

test("retention periods match the privacy policy", () => {
    assert.equal(RETENTION.holderPhotoDays, 183);
    assert.equal(RETENTION.scanLogDays, 365);
    assert.equal(RETENTION.inactiveAttendeeDays, 1095);
});

test("dry-run only counts, off does nothing", async () => {
    const db = fakeDb();
    const { results } = await runRetention({ mode: "dry-run", db });
    assert.deepEqual(Object.values(results), [3, 3, 3, 3]);
    assert.equal(db.calls.execute, 0);

    const idle = fakeDb();
    assert.deepEqual((await runRetention({ mode: "off", db: idle })).results, {});
    assert.equal(idle.calls.query + idle.calls.execute, 0);
});

test("purge works in batches until a batch comes back incomplete", async () => {
    // Première règle : deux lots pleins puis un lot partiel ; les autres règles n'ont rien à purger.
    const db = fakeDb({ affected: [500, 500, 12, 0, 0, 0] });
    const { results } = await runRetention({ mode: "on", db });
    assert.equal(results.holder_photos, 1012);
    assert.equal(results.scan_logs, 0);
    assert.equal(db.calls.execute, 6);
});
