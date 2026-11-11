const test = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/prisma/client");
const pawaPay = require("../src/services/pawapay.service");
const walletBalances = require("../src/services/wallet_balance.service");

test("pawaPay wallet balances are parsed defensively", () => {
    const wallets = walletBalances.parseWalletBalances({ balances: [
        { country: "COD", currency: "USD", balance: "1250.456" },
        { country: "cod", currency: "cdf", balance: "90000", provider: "" },
        { country: "ZMB", currency: "ZMW", balance: "12", mno: "MTN_MOMO_ZMB" },
        { country: "COD", currency: "USD", balance: "not-a-number" },
        { currency: "USD", balance: "5" }
    ] });
    assert.deepEqual(wallets.map(item => [item.country, item.currency, item.provider, item.balance.toString()]), [
        ["COD", "USD", "", "1250.46"],
        ["COD", "CDF", "", "90000"],
        ["ZMB", "ZMW", "MTN_MOMO_ZMB", "12"]
    ]);
    assert.deepEqual(walletBalances.parseWalletBalances(null), []);
});

test("wallet balances are refreshed at most every five minutes and replace the previous snapshot", async t => {
    const originals = { get: pawaPay.getWalletBalances, transaction: prisma.$transaction, model: prisma.pawaPayWalletBalance };
    t.after(() => {
        pawaPay.getWalletBalances = originals.get;
        prisma.$transaction = originals.transaction;
        prisma.pawaPayWalletBalance = originals.model;
        walletBalances.resetRefreshTimer();
    });
    let calls = 0;
    const written = [];
    pawaPay.getWalletBalances = async () => { calls += 1; return { balances: [{ country: "COD", currency: "USD", balance: "10" }] }; };
    prisma.pawaPayWalletBalance = { deleteMany: () => ({ op: "delete" }), createMany: ({ data }) => ({ op: "create", data }) };
    prisma.$transaction = async ops => { written.push(ops); return ops; };
    walletBalances.resetRefreshTimer();

    const now = Date.parse("2026-11-11T10:00:00Z");
    assert.equal((await walletBalances.refreshIfDue(now)).length, 1);
    assert.equal(await walletBalances.refreshIfDue(now + 60_000), null);
    assert.equal(calls, 1);
    assert.deepEqual(written[0].map(op => op.op), ["delete", "create"]);
    assert.equal(written[0][1].data[0].fetched_at.getTime(), now);

    // Sans jeton pawaPay ou en cas d'erreur, le worker continue sans relevé.
    pawaPay.getWalletBalances = async () => { throw new pawaPay.PawaPayConfigurationError("absent"); };
    assert.equal(await walletBalances.refreshIfDue(now + 5 * 60_000), null);
    pawaPay.getWalletBalances = async () => { throw new pawaPay.PawaPayRequestError("down", { status: 503 }); };
    assert.equal(await walletBalances.refreshIfDue(now + 10 * 60_000), null);
});
