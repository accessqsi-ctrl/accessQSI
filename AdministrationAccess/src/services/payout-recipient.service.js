// Pays et devises proposés pour un reversement saisi à la main (pays couverts par pawaPay pour les devises AccessQ).
// L'opérateur n'est pas choisi ici : le backend le détecte auprès de pawaPay et vérifie qu'il correspond au pays.
// trunkZero : le 0 initial du format national disparaît au format international (0991234567 → 243991234567).
const PAYOUT_COUNTRIES = Object.freeze([
    { code: 'COD', name: 'RD Congo', prefix: '243', currencies: ['CDF', 'USD'], trunkZero: true },
    { code: 'CMR', name: 'Cameroun', prefix: '237', currencies: ['XAF'], trunkZero: false },
    { code: 'COG', name: 'Congo-Brazzaville', prefix: '242', currencies: ['XAF'], trunkZero: false },
    { code: 'GAB', name: 'Gabon', prefix: '241', currencies: ['XAF'], trunkZero: false },
    { code: 'CIV', name: 'Côte d’Ivoire', prefix: '225', currencies: ['XOF'], trunkZero: false },
    { code: 'SEN', name: 'Sénégal', prefix: '221', currencies: ['XOF'], trunkZero: false },
    { code: 'BEN', name: 'Bénin', prefix: '229', currencies: ['XOF'], trunkZero: false },
    { code: 'BFA', name: 'Burkina Faso', prefix: '226', currencies: ['XOF'], trunkZero: false },
    { code: 'RWA', name: 'Rwanda', prefix: '250', currencies: ['RWF'], trunkZero: true },
    { code: 'ZMB', name: 'Zambie', prefix: '260', currencies: ['ZMW'], trunkZero: true },
    { code: 'KEN', name: 'Kenya', prefix: '254', currencies: ['KES'], trunkZero: true },
    { code: 'UGA', name: 'Ouganda', prefix: '256', currencies: ['UGX'], trunkZero: true },
    { code: 'TZA', name: 'Tanzanie', prefix: '255', currencies: ['TZS'], trunkZero: true },
    { code: 'NGA', name: 'Nigeria', prefix: '234', currencies: ['NGN'], trunkZero: true },
    { code: 'GHA', name: 'Ghana', prefix: '233', currencies: ['GHS'], trunkZero: true }
]);

const findCountry = (code) => PAYOUT_COUNTRIES.find((country) => country.code === String(code || '').trim().toUpperCase()) || null;

// Renvoie le numéro au format international sans « + » (ex. 243991234567), ou null s'il est inutilisable.
const normalizeRecipientPhone = (raw, country) => {
    let digits = String(raw || '').replace(/\D/g, '');
    if (String(raw || '').trim().startsWith('00')) digits = digits.slice(2);
    if (!digits.startsWith(country.prefix)) {
        digits = country.prefix + (country.trunkZero && digits.startsWith('0') ? digits.slice(1) : digits);
    }
    const national = digits.slice(country.prefix.length);
    if (national.startsWith('0') && country.trunkZero) return null;
    return /^\d{10,15}$/.test(digits) && national.length >= 7 ? digits : null;
};

module.exports = { PAYOUT_COUNTRIES, findCountry, normalizeRecipientPhone };
