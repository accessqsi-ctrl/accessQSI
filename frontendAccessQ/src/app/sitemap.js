import { SITE_URL } from "./lib/seo";

// Seules les pages publiques destinées aux moteurs de recherche y figurent.
export default function sitemap() {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
