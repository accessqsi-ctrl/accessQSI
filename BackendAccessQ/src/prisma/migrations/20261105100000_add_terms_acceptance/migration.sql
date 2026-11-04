-- Acceptation des conditions : version acceptée et date, pour les organisateurs et les participants.
ALTER TABLE "usersQ" ADD COLUMN "terms_version" VARCHAR(20),
ADD COLUMN "terms_accepted_at" TIMESTAMP(3);

ALTER TABLE "attendees" ADD COLUMN "terms_version" VARCHAR(20),
ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
