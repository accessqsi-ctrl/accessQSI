// Version des textes juridiques publiés. Doit rester identique à TERMS_VERSION dans
// BackendAccessQ/src/config/legal.js : la changer oblige chaque compte à les accepter à nouveau.
export const LEGAL_VERSION = "2026-11-05";
export const LEGAL_UPDATED_LABEL = "5 novembre 2026";

// Identité de l'éditeur. Les mentions « à compléter » doivent être remplies avant la mise en ligne.
export const COMPANY = {
  brand: "AccessQ",
  legalName: "INKLI SOFT, TINKLI SOFTWARE",
  legalForm: "société à responsabilité limitée unipersonnelle(SARLU)",
  rccm: "CD/KNG/RCCM/26-B-02526",
  idNat: "01-J6100-N00001Z",
  taxId: "A2628437P",
  address: "14 Av maman sese,Q. Binza-Pigeon, C. Ngaliema, Kinshasa, République démocratique du Congo",
  supportEmail: "access.supportclient@gmail.com",
  privacyEmail: "access.supportclient@gmail.com",
  courts: "les juridictions compétentes de Kinshasa"
};

export const LEGAL_LINKS = [
  { href: "/conditions-utilisation", label: "Conditions d’utilisation" },
  { href: "/conditions-vente", label: "Conditions de vente des billets" },
  { href: "/confidentialite", label: "Politique de confidentialité" }
];
