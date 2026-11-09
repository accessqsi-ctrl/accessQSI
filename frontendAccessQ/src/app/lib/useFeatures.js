"use client";

import { useEffect, useState } from "react";

// Interrupteurs définis côté backend (PRO_PAYMENTS_ENABLED, REGISTRATION_FORMS_ENABLED), lus à l'exécution.
// Tant qu'ils ne sont pas chargés, ou si le chargement échoue, tout reste masqué.
const DISABLED = Object.freeze({ proPayments: false, registrationForms: false });

let pending = null;
const loadFeatures = () => {
  pending ||= fetch("/api/config/features", { credentials: "omit" })
    .then(response => (response.ok ? response.json() : null))
    .then(data => ({ ...DISABLED, ...(data?.features || {}) }))
    .catch(() => { pending = null; return DISABLED; });
  return pending;
};

export function useFeatures() {
  const [features, setFeatures] = useState(DISABLED);
  useEffect(() => {
    let active = true;
    loadFeatures().then(value => { if (active) setFeatures(value); });
    return () => { active = false; };
  }, []);
  return features;
}
