import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "AccessQ, le contrôle d’accès par QR code pour vos événements";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Image de partage générée au build : aperçu des liens sur WhatsApp, LinkedIn, Facebook…
export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/logo/access_logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #ecfdf5 100%)", color: "#0f172a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoSrc} width={72} height={72} alt="" />
          <span style={{ fontSize: 44, fontWeight: 800, color: "#1d4ed8" }}>AccessQ</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, maxWidth: 980 }}>Le contrôle d’accès par QR code pour vos événements</div>
          <div style={{ fontSize: 32, color: "#475569", maxWidth: 960 }}>Billets et badges nominatifs, scan sur smartphone, suivi de chaque passage.</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26, fontWeight: 700, color: "#047857" }}>
          <span>Mariages</span><span>·</span><span>Conférences</span><span>·</span><span>Concerts</span><span>·</span><span>Entreprises</span>
        </div>
      </div>
    ),
    size
  );
}
