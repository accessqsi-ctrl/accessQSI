-- Dernier relevé des soldes réels des wallets pawaPay, affiché dans la console d'administration.
CREATE TABLE "pawapay_wallet_balances" (
    "wallet_balance_id" UUID NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "balance" DECIMAL(18,2) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pawapay_wallet_balances_pkey" PRIMARY KEY ("wallet_balance_id")
);

CREATE UNIQUE INDEX "pawapay_wallet_balances_country_currency_provider_key" ON "pawapay_wallet_balances"("country", "currency", "provider");
