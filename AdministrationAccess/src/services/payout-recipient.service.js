// Pays et devises proposés pour un reversement saisi à la main (pays couverts par pawaPay pour les devises AccessQ).
// L'opérateur est choisi par le super-admin (codes pawaPay) : le backend vérifie qu'il est actif pour ce pays et cette devise,
// sans détection automatique (un numéro porté vers un autre opérateur serait mal identifié).
// trunkZero : le 0 initial du format national disparaît au format international (0991234567 → 243991234567).
const PAYOUT_COUNTRIES = Object.freeze([
    { code: 'COD', name: 'RD Congo', prefix: '243', currencies: ['CDF', 'USD'], trunkZero: true, providers: [{ code: 'VODACOM_MPESA_COD', name: 'Vodacom M-Pesa' }, { code: 'AIRTEL_COD', name: 'Airtel Money' }, { code: 'ORANGE_COD', name: 'Orange Money' }] },
    { code: 'CMR', name: 'Cameroun', prefix: '237', currencies: ['XAF'], trunkZero: false, providers: [{ code: 'MTN_MOMO_CMR', name: 'MTN MoMo' }, { code: 'ORANGE_CMR', name: 'Orange Money' }] },
    { code: 'COG', name: 'Congo-Brazzaville', prefix: '242', currencies: ['XAF'], trunkZero: false, providers: [{ code: 'MTN_MOMO_COG', name: 'MTN MoMo' }, { code: 'AIRTEL_COG', name: 'Airtel Money' }] },
    { code: 'GAB', name: 'Gabon', prefix: '241', currencies: ['XAF'], trunkZero: false, providers: [{ code: 'AIRTEL_GAB', name: 'Airtel Money' }] },
    { code: 'CIV', name: 'Côte d’Ivoire', prefix: '225', currencies: ['XOF'], trunkZero: false, providers: [{ code: 'MTN_MOMO_CIV', name: 'MTN MoMo' }, { code: 'ORANGE_CIV', name: 'Orange Money' }, { code: 'WAVE_CIV', name: 'Wave' }] },
    { code: 'SEN', name: 'Sénégal', prefix: '221', currencies: ['XOF'], trunkZero: false, providers: [{ code: 'ORANGE_SEN', name: 'Orange Money' }, { code: 'FREE_SEN', name: 'Free Money' }, { code: 'WAVE_SEN', name: 'Wave' }] },
    { code: 'BEN', name: 'Bénin', prefix: '229', currencies: ['XOF'], trunkZero: false, providers: [{ code: 'MTN_MOMO_BEN', name: 'MTN MoMo' }, { code: 'MOOV_BEN', name: 'Moov Money' }] },
    { code: 'BFA', name: 'Burkina Faso', prefix: '226', currencies: ['XOF'], trunkZero: false, providers: [{ code: 'ORANGE_BFA', name: 'Orange Money' }, { code: 'MOOV_BFA', name: 'Moov Money' }] },
    { code: 'RWA', name: 'Rwanda', prefix: '250', currencies: ['RWF'], trunkZero: true, providers: [{ code: 'MTN_MOMO_RWA', name: 'MTN MoMo' }, { code: 'AIRTEL_RWA', name: 'Airtel Money' }] },
    { code: 'ZMB', name: 'Zambie', prefix: '260', currencies: ['ZMW'], trunkZero: true, providers: [{ code: 'MTN_MOMO_ZMB', name: 'MTN MoMo' }, { code: 'AIRTEL_OAPI_ZMB', name: 'Airtel Money' }, { code: 'ZAMTEL_ZMB', name: 'Zamtel Kwacha' }] },
    { code: 'KEN', name: 'Kenya', prefix: '254', currencies: ['KES'], trunkZero: true, providers: [{ code: 'MPESA_KEN', name: 'Safaricom M-Pesa' }] },
    { code: 'UGA', name: 'Ouganda', prefix: '256', currencies: ['UGX'], trunkZero: true, providers: [{ code: 'MTN_MOMO_UGA', name: 'MTN MoMo' }, { code: 'AIRTEL_OAPI_UGA', name: 'Airtel Money' }] },
    { code: 'TZA', name: 'Tanzanie', prefix: '255', currencies: ['TZS'], trunkZero: true, providers: [{ code: 'VODACOM_TZA', name: 'Vodacom M-Pesa' }, { code: 'AIRTEL_TZA', name: 'Airtel Money' }, { code: 'TIGO_TZA', name: 'Tigo Pesa' }, { code: 'HALOTEL_TZA', name: 'Halopesa' }] },
    { code: 'NGA', name: 'Nigeria', prefix: '234', currencies: ['NGN'], trunkZero: true, providers: [{ code: 'MTN_MOMO_NGA', name: 'MTN MoMo' }, { code: 'AIRTEL_NGA', name: 'Airtel Money' }] },
    { code: 'GHA', name: 'Ghana', prefix: '233', currencies: ['GHS'], trunkZero: true, providers: [{ code: 'MTN_MOMO_GHA', name: 'MTN MoMo' }, { code: 'VODAFONE_GHA', name: 'Telecel Cash' }, { code: 'AIRTELTIGO_GHA', name: 'AirtelTigo Money' }] }
]);

const findCountry = (code) => PAYOUT_COUNTRIES.find((country) => country.code === String(code || '').trim().toUpperCase()) || null;

// Opérateur choisi, s'il appartient bien au pays (ex. ORANGE_COD pour COD).
const findProvider = (country, code) => country?.providers.find((provider) => provider.code === String(code || '').trim().toUpperCase()) || null;

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

module.exports = { PAYOUT_COUNTRIES, findCountry, findProvider, normalizeRecipientPhone };
