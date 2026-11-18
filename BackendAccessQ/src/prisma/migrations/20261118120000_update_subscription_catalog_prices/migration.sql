-- Keep the stored USD catalog prices aligned with the current subscription guide.
UPDATE "plan" SET "cost" = 50, "currency" = 'USD' WHERE UPPER("title") = 'ESSENTIAL';
UPDATE "plan" SET "cost" = 85, "currency" = 'USD' WHERE UPPER("title") = 'PRO';
UPDATE "plan" SET "cost" = 20, "currency" = 'USD' WHERE UPPER("title") = 'EVENT_PASS';
