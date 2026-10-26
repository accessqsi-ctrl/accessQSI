import { noIndex } from "../lib/seo";

export const metadata = {
  title: "Mot de passe oublié",
  robots: noIndex,
};

export default function ForgotPasswordLayout({ children }) {
  return children;
}
