import { test } from "node:test";
import assert from "node:assert/strict";
import { fromDateTimeLocal, toDateTimeLocal } from "../src/app/lib/dateTimeLocal.mjs";

// Les tests sont lancés avec TZ=Africa/Kinshasa (UTC+1, sans heure d'été) : voir le script npm.
test("une saisie locale est envoyée en UTC", () => {
    assert.equal(fromDateTimeLocal("2026-10-26T08:00"), "2026-10-26T07:00:00.000Z");
});

test("un instant UTC est affiché en heure locale", () => {
    assert.equal(toDateTimeLocal("2026-10-26T07:00:00.000Z"), "2026-10-26T08:00");
});

test("l'aller-retour conserve la saisie", () => {
    assert.equal(toDateTimeLocal(fromDateTimeLocal("2026-12-31T23:30")), "2026-12-31T23:30");
});

test("les champs vides ou invalides restent vides", () => {
    assert.equal(toDateTimeLocal(null), "");
    assert.equal(toDateTimeLocal("pas une date"), "");
    assert.equal(fromDateTimeLocal(""), "");
});
