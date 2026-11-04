import { SITE_URL } from "./lib/seo";
import { LEGAL_LINKS } from "./lib/legal";

// Seules les pages publiques destinées aux moteurs de recherche y figurent.
export default function sitemap() {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    ...LEGAL_LINKS.map(link => ({ url: `${SITE_URL}${link.href}`, changeFrequency: "yearly", priority: 0.2 })),
  ];
}
