// Les paiements de billets sont crédités intégralement à l'organisateur.

// Devises acceptées pour le prix d'une offre (celles que pawaPay propose sur nos marchés).
const TICKET_CURRENCIES = Object.freeze(["USD", "CDF", "XOF", "XAF", "RWF", "ZMW", "KES", "UGX", "TZS", "NGN", "GHS"]);
const DEFAULT_HOLD_MINUTES = 15;

const enabled = value => String(value || "false").trim().toLowerCase() === "true";

const getTicketingConfig = (env = process.env) => {
    const hold = Number.parseInt(env.TICKET_PAYMENT_HOLD_MINUTES || "", 10);
    return {
        enabled: enabled(env.TICKET_PAYMENTS_ENABLED),
        holdMinutes: Number.isInteger(hold) && hold >= 5 && hold <= 60 ? hold : DEFAULT_HOLD_MINUTES
    };
};
module.exports = { TICKET_CURRENCIES, getTicketingConfig };
