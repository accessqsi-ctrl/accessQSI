import test from "node:test";
import assert from "node:assert/strict";

import {
    buildScanLogQuery,
    localDateTimeToIso,
    scanStatusLabel
} from "../src/app/lib/dashboardScans.mjs";

test("buildScanLogQuery includes pagination and active filters", () => {
    const query = new URLSearchParams(buildScanLogQuery({
        page: 4,
        pageSize: 50,
        filters: {
            eventId: "5",
            areaId: "7",
            status: "denied",
            search: " Jean ",
            sortOrder: "asc",
            dateFrom: "",
            dateTo: "",
            timeFrom: "",
            timeTo: ""
        }
    }));

    assert.equal(query.get("page"), "4");
    assert.equal(query.get("pageSize"), "50");
    assert.equal(query.get("eventId"), "5");
    assert.equal(query.get("areaId"), "7");
    assert.equal(query.get("status"), "denied");
    assert.equal(query.get("search"), "Jean");
    assert.equal(query.get("sortOrder"), "asc");
});

test("localDateTimeToIso applies the beginning or end of day fallback", () => {
    assert.match(localDateTimeToIso("2026-09-28", "", "00:00"), /^2026-09-2[78]T/);
    assert.match(localDateTimeToIso("2026-09-28", "", "23:59"), /^2026-09-2[89]T/);
    assert.equal(localDateTimeToIso("", "10:00", "00:00"), "");
});

test("scanStatusLabel explains denied scan reasons", () => {
    assert.equal(scanStatusLabel("authorized"), "Autorisé");
    assert.equal(scanStatusLabel("denied_area_not_allowed"), "Zone non autorisée");
    assert.equal(scanStatusLabel("unknown"), "Refusé");
});

