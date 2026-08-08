INSERT INTO "plan" ("title", "cost", "currency", "features")
VALUES (
    'ENTERPRISE',
    0,
    'USD',
    '["bulk_qr_import","custom_card_templates","scan_exports","advanced_analytics"]'::jsonb
)
ON CONFLICT ("title") DO UPDATE SET
"currency" = EXCLUDED."currency",
"features" = EXCLUDED."features";
