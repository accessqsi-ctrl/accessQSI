export const SITE_NAME = "AccessQ";

// URL publique du site : sert de base aux liens canoniques et aux images de partage.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const SITE_DESCRIPTION = "Créez des billets et badges QR nominatifs, contrôlez les entrées depuis un smartphone et suivez chaque passage. Offre Découverte gratuite.";

// Next.js remplace l’objet openGraph d’un parent au lieu de le fusionner : chaque page qui
// redéfinit openGraph part de cette base pour conserver le nom du site et la langue.
export const baseOpenGraph = {
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website"
};

export const noIndex = { index: false, follow: false };
