// Relevé périodique des soldes réels des wallets pawaPay. La console d'administration ne parle jamais à pawaPay :
// elle lit ce relevé pour comparer le solde calculé de la plateforme au solde réel (frais pawaPay déduits).
const { Prisma } = require("@prisma/client");
const prisma = require("../prisma/client");
const pawaPay = require("./pawapay.service");
const logger = require("../utils/logger");
const { extractPawaPayFailure } = require("./payment/format");

const REFRESH_INTERVAL_MS = 5 * 60_000;
let lastAttemptAt = 0;

// Accepte { balances: [...] } ou un tableau ; ignore les lignes illisibles plutôt que d'enregistrer un faux solde.
const parseWalletBalances = response => {
    const rows = Array.isArray(response) ? response : Array.isArray(response?.balances) ? response.balances : [];
    const wallets = new Map();
    for (const row of rows) {
        const country = String(row?.country || "").trim().toUpperCase();
        const currency = String(row?.currency || "").trim().toUpperCase();
        const provider = String(row?.provider || row?.mno || "").trim().toUpperCase();
        const raw = String(row?.balance ?? "").trim();
        if (!/^[A-Z]{3}$/.test(country) || !/^[A-Z]{3}$/.test(currency) || !/^-?\d+(\.\d+)?$/.test(raw)) continue;
        wallets.set(`${country}|${currency}|${provider}`, { country, currency, provider, balance: new Prisma.Decimal(raw).toDecimalPlaces(2) });
    }
    return [...wallets.values()];
};

const refreshWalletBalances = async (now = new Date()) => {
    const wallets = parseWalletBalances(await pawaPay.getWalletBalances());
    if (!wallets.length) {
        logger.warn("wallet_balances.empty_response");
        return [];
    }
    await prisma.$transaction([
        prisma.pawaPayWalletBalance.deleteMany({}),
        prisma.pawaPayWalletBalance.createMany({ data: wallets.map(wallet => ({ ...wallet, fetched_at: now })) })
    ]);
    return wallets;
};

// Appelé à chaque passage du worker : un relevé toutes les 5 minutes au plus. Sans jeton pawaPay, rien n'est fait.
const refreshIfDue = async (now = Date.now()) => {
    if (now - lastAttemptAt < REFRESH_INTERVAL_MS) return null;
    lastAttemptAt = now;
    try {
        return await refreshWalletBalances(new Date(now));
    } catch (error) {
        if (error instanceof pawaPay.PawaPayConfigurationError) return null;
        logger.warn("wallet_balances.refresh_failed", { status: error.status, pawapay_failure_code: extractPawaPayFailure(error.responseData).code });
        return null;
    }
};

const resetRefreshTimer = () => { lastAttemptAt = 0; };

module.exports = { parseWalletBalances, refreshIfDue, refreshWalletBalances, resetRefreshTimer };
