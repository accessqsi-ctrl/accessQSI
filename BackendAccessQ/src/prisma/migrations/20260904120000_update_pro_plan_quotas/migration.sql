-- Aligne les événements Pro existants sur le nouveau quota de 350 QR.
-- Un événement qui contient déjà plus de 350 QR conserve assez de capacité
-- pour ses QR existants, sans autoriser de génération supplémentaire.
UPDATE "events" AS e
SET "qr_limit" = GREATEST(
    COALESCE((SELECT COUNT(*)::integer FROM "qr_codes" q WHERE q."event_id" = e."event_id"), 0),
    350
)
FROM "organizations" o
JOIN "plan" p ON p."plan_id" = o."subscription_plan"
WHERE o."org_id" = e."org_id"
  AND p."title" = 'PRO';
