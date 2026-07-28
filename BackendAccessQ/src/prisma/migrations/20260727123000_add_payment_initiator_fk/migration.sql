DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payments_initiated_by_id_fkey'
          AND conrelid = '"payments"'::regclass
    ) THEN
        ALTER TABLE "payments"
        ADD CONSTRAINT "payments_initiated_by_id_fkey"
        FOREIGN KEY ("initiated_by_id") REFERENCES "usersQ"("user_id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;
