import { noIndex } from "../lib/seo";

export const metadata = {
  title: "Nouveau mot de passe",
  referrer: "no-referrer",
  robots: noIndex,
};

export default function ResetPasswordLayout({ children }) {
  return children;
}
