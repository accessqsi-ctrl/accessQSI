const test = require("node:test");
const assert = require("node:assert/strict");
const { commissionBpsFor, getTicketingConfig, percentToBps, splitAmount } = require("../src/config/ticketing");

test("ticket commission defaults to 10 % and can be overridden per organization", () => {
    assert.equal(getTicketingConfig({}).defaultCommissionBps, 1000);
    assert.equal(getTicketingConfig({ TICKET_COMMISSION_PERCENT: "7,5" }).defaultCommissionBps, 750);
    assert.equal(getTicketingConfig({ TICKET_COMMISSION_PERCENT: "80" }).defaultCommissionBps, 1000);
    assert.equal(getTicketingConfig({}).enabled, false);
    assert.equal(commissionBpsFor({ ticket_commission_bps: null }, { defaultCommissionBps: 1000 }), 1000);
    assert.equal(commissionBpsFor({ ticket_commission_bps: 0 }, { defaultCommissionBps: 1000 }), 0);
    assert.equal(percentToBps(""), null);
    assert.equal(percentToBps("-1"), null);
});

test("the organizer receives the exact remainder after the rounded commission", () => {
    const usd = splitAmount("12.50", 750, 2);
    assert.equal(usd.commission.toString(), "0.94");
    assert.equal(usd.organizer.toString(), "11.56");
    const cdf = splitAmount("5000", 1000, 0);
    assert.equal(cdf.commission.toString(), "500");
    assert.equal(cdf.organizer.toString(), "4500");
    const odd = splitAmount("15", 1000, 0);
    assert.equal(odd.commission.plus(odd.organizer).toString(), "15");
});
