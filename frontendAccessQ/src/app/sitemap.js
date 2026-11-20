
import { SITE_URL } from "./lib/seo";
import { LEGAL_LINKS } from "./lib/legal";

const BASE_URL = SITE_URL.replace(/\/$/, "");

export default function sitemap() {
  return [
    {
      url: BASE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...LEGAL_LINKS.map((link) => ({
      url: `${BASE_URL}${link.href}`,
      changeFrequency: "yearly",
      priority: 0.3,
    })),
  ];
}
