// Version en vigueur des conditions (CGU, conditions de vente des billets, politique de confidentialité).
// À changer à chaque modification des textes publiés : les comptes devront les accepter à nouveau.
// Doit rester identique à LEGAL_VERSION dans frontendAccessQ/src/app/lib/legal.js.
const TERMS_VERSION = "2026-11-05";

// Seul un vrai booléen vaut acceptation : une case cochée côté client, jamais une valeur implicite.
const hasAcceptedTerms = value => value === true;

module.exports = { TERMS_VERSION, hasAcceptedTerms };
