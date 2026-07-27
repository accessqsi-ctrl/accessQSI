UPDATE "plan"
SET "title" = UPPER(BTRIM("title"));

UPDATE "organizations" AS organization
SET "subscription_plan" = (
  SELECT MIN(candidate."plan_id")
  FROM "plan" AS candidate
  WHERE candidate."title" = current_plan."title"
)
FROM "plan" AS current_plan
WHERE organization."subscription_plan" = current_plan."plan_id";

DELETE FROM "plan" AS duplicate
USING "plan" AS canonical
WHERE duplicate."title" = canonical."title"
  AND duplicate."plan_id" > canonical."plan_id";

CREATE UNIQUE INDEX "plan_title_key" ON "plan"("title");
