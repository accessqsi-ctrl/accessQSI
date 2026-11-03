// Billetterie payante : l'argent est encaissé par la plateforme, qui garde sa commission et doit le reste à l'organisateur.
const { Prisma } = require("@prisma/client");

// Devises acceptées pour le prix d'une offre (celles que pawaPay propose sur nos marchés).
const TICKET_CURRENCIES = Object.freeze(["USD", "CDF", "XOF", "XAF", "RWF", "ZMW", "KES", "UGX", "TZS", "NGN", "GHS"]);
const DEFAULT_COMMISSION_PERCENT = 10;
const MAX_COMMISSION_BPS = 5000;
const DEFAULT_HOLD_MINUTES = 15;

const enabled = value => String(value || "false").trim().toLowerCase() === "true";

// Un pourcentage (« 7.5 ») devient des points de base (750). Hors bornes : null.
const percentToBps = value => {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed)) return null;
    const bps = Math.round(parsed * 100);
    return bps >= 0 && bps <= MAX_COMMISSION_BPS ? bps : null;
};

const getTicketingConfig = (env = process.env) => {
    const hold = Number.parseInt(env.TICKET_PAYMENT_HOLD_MINUTES || "", 10);
    return {
        enabled: enabled(env.TICKET_PAYMENTS_ENABLED),
        defaultCommissionBps: percentToBps(env.TICKET_COMMISSION_PERCENT) ?? DEFAULT_COMMISSION_PERCENT * 100,
        holdMinutes: Number.isInteger(hold) && hold >= 5 && hold <= 60 ? hold : DEFAULT_HOLD_MINUTES
    };
};

const commissionBpsFor = (organization, config = getTicketingConfig()) => (
    Number.isInteger(organization?.ticket_commission_bps) ? organization.ticket_commission_bps : config.defaultCommissionBps
);

// Répartition d'un montant : la commission est arrondie à la précision de l'opérateur, l'organisateur reçoit le reste.
const splitAmount = (amount, bps, decimals = 2) => {
    const gross = new Prisma.Decimal(amount);
    const places = Number.isInteger(Number(decimals)) ? Math.max(0, Math.min(2, Number(decimals))) : 2;
    const commission = gross.mul(bps).div(10000).toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP);
    return { commission, organizer: gross.minus(commission) };
};

module.exports = { TICKET_CURRENCIES, DEFAULT_COMMISSION_PERCENT, MAX_COMMISSION_BPS, commissionBpsFor, getTicketingConfig, percentToBps, splitAmount };
