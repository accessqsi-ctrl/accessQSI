import { noIndex } from "../lib/seo";

export const metadata = {
  title: "Scanner",
  robots: noIndex,
};

export default function ScanLayout({ children }) {
  return children;
}
