
export const SITE_NAME = "AccessQ";

// URL publique officielle d'AccessQ
export const SITE_URL =
  process.env.SITE_URL || "https://accessq.tinklisoftware.com";

export const SITE_DESCRIPTION =
  "Créez des billets et badges QR nominatifs, contrôlez les entrées depuis un smartphone et suivez chaque passage. Offre Découverte gratuite.";

// Métadonnées Open Graph communes
export const baseOpenGraph = {
  siteName: SITE_NAME,
  locale: "fr_FR",
  type: "website",  
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
};

// Métadonnées destinées aux pages privées
export const noIndex = {
  index: false,
  follow: false,
};
