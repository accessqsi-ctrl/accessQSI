import DashboardShell from "./DashboardShell";
import { noIndex } from "../lib/seo";

export const metadata = {
    title: "Espace de gestion",
    robots: noIndex,
};

export default function DashboardLayout({ children }) {
    return <DashboardShell>{children}</DashboardShell>;
}
