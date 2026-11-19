const test = require("node:test");
const assert = require("node:assert/strict");
const { getTicketingConfig } = require("../src/config/ticketing");

test("ticket payments can be enabled without commission configuration", () => {
    assert.equal(getTicketingConfig({}).enabled, false);
    assert.equal(getTicketingConfig({ TICKET_PAYMENTS_ENABLED: "true" }).enabled, true);
    assert.equal(getTicketingConfig({ TICKET_PAYMENT_HOLD_MINUTES: "20" }).holdMinutes, 20);
});
