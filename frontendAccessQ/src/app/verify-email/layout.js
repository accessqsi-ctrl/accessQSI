import { noIndex } from "../lib/seo";

export const metadata = {
  title: "Vérification de l’adresse e-mail",
  referrer: "no-referrer",
  robots: noIndex,
};

export default function VerifyEmailLayout({ children }) {
  return children;
}
