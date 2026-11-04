const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const csv = require("csv-parser");
const { csvParserOptions, detectCsvSeparator } = require("../src/utils/csvImport");

const parse = (text) => new Promise((resolve, reject) => {
    const rows = [];
    Readable.from([text]).pipe(csv(csvParserOptions(text)))
        .on("data", row => rows.push(row)).on("error", reject).on("end", () => resolve(rows));
});

test("the separator is detected from the header line", () => {
    assert.equal(detectCsvSeparator("fullName;email;validFrom"), ";");
    assert.equal(detectCsvSeparator("fullName,email,validFrom"), ",");
});

test("a French Excel file (semicolons and BOM) is read column by column", async () => {
    const rows = await parse("﻿fullName;email;validFrom\nGrace Mbuyi;grace@example.com;02/11/2026 08:00\n");
    assert.deepEqual(rows, [{ fullName: "Grace Mbuyi", email: "grace@example.com", validFrom: "02/11/2026 08:00" }]);
});

test("comma-separated files keep working, including commas inside quotes", async () => {
    const rows = await parse('fullName,cardMessage\n"Kabongo, Marie","Bienvenue, Marie"\n');
    assert.deepEqual(rows, [{ fullName: "Kabongo, Marie", cardMessage: "Bienvenue, Marie" }]);
});
