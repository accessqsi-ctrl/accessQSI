// Limite d'utilisation par période calendaire (jour, semaine, mois) évaluée dans le fuseau
// horaire de l'organisation, pour qu'un « 1 repas par jour » se réinitialise à minuit local.
const PERIOD_UNITS = Object.freeze(["day", "week", "month"]);
const PERIOD_LABELS = Object.freeze({ day: "jour", week: "semaine", month: "mois" });
const DEFAULT_TIMEZONE = "UTC";

const isValidTimeZone = (timeZone) => {
    if (!timeZone || typeof timeZone !== "string") return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
        return true;
    } catch {
        return false;
    }
};

const resolveTimeZone = (timeZone) => {
    if (isValidTimeZone(timeZone)) return timeZone;
    const fallback = process.env.DEFAULT_TIMEZONE;
    return isValidTimeZone(fallback) ? fallback : DEFAULT_TIMEZONE;
};

// Composantes de date locales (année, mois, jour, jour de semaine) d'un instant dans un fuseau.
const zonedParts = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        weekday: "short",
        hourCycle: "h23"
    }).formatToParts(date);
    const value = type => parts.find(part => part.type === type)?.value;
    return {
        year: Number(value("year")),
        month: Number(value("month")),
        day: Number(value("day")),
        hour: Number(value("hour")),
        minute: Number(value("minute")),
        second: Number(value("second")),
        weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(value("weekday"))
    };
};

const timeZoneOffsetMs = (date, timeZone) => {
    const parts = zonedParts(date, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUtc - (date.getTime() - date.getMilliseconds());
};

// Instant UTC correspondant à une heure locale (« heure murale ») dans un fuseau.
const zonedDateTime = (year, month, day, hour, minute, second, timeZone) => {
    const guess = Date.UTC(year, month - 1, day, hour, minute, second);
    let instant = guess - timeZoneOffsetMs(new Date(guess), timeZone);
    // Second passage pour les jours de changement d'heure.
    instant = guess - timeZoneOffsetMs(new Date(instant), timeZone);
    return new Date(instant);
};

// Instant UTC correspondant à minuit local de la date calendaire donnée.
const zonedMidnight = (year, month, day, timeZone) => zonedDateTime(year, month, day, 0, 0, 0, timeZone);

const getPeriodBounds = (unit, now = new Date(), timeZone = DEFAULT_TIMEZONE) => {
    if (!PERIOD_UNITS.includes(unit)) throw new Error(`Unité de période inconnue : ${unit}`);
    const zone = resolveTimeZone(timeZone);
    const { year, month, day, weekday } = zonedParts(now, zone);
    // Date.UTC normalise les dépassements (jour 32, mois 13) vers la bonne date calendaire.
    const calendarDate = (y, m, d) => {
        const normalized = new Date(Date.UTC(y, m - 1, d));
        return [normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, normalized.getUTCDate()];
    };

    let start;
    let next;
    if (unit === "day") {
        start = [year, month, day];
        next = calendarDate(year, month, day + 1);
    } else if (unit === "week") {
        start = calendarDate(year, month, day - weekday);
        next = calendarDate(start[0], start[1], start[2] + 7);
    } else {
        start = [year, month, 1];
        next = calendarDate(year, month + 1, 1);
    }

    return {
        start: zonedMidnight(...start, zone),
        next: zonedMidnight(...next, zone),
        timeZone: zone
    };
};

const describePeriodLimit = (limit, unit) => {
    if (!limit || !PERIOD_UNITS.includes(unit)) return null;
    return `${limit} par ${PERIOD_LABELS[unit]}`;
};

const formatPeriodBoundary = (date, timeZone) => new Intl.DateTimeFormat("fr-FR", {
    timeZone: resolveTimeZone(timeZone),
    dateStyle: "short",
    timeStyle: "short"
}).format(date);

module.exports = {
    PERIOD_UNITS,
    PERIOD_LABELS,
    describePeriodLimit,
    formatPeriodBoundary,
    getPeriodBounds,
    isValidTimeZone,
    resolveTimeZone,
    zonedDateTime
};
