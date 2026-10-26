"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Download, Loader2, Mail, RotateCw } from "lucide-react";

export default function PassAccessPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 p-12 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">Chargement…</main>}><PassAccessContent /></Suspense>;
}

function PassAccessContent() {
  const search = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const queryToken = search.get("token");
    const stored = queryToken || sessionStorage.getItem("accessq-pass-token") || "";
    if (queryToken) {
      sessionStorage.setItem("accessq-pass-token", queryToken);
      router.replace("/register/access");
    }
    setToken(stored);
  }, [router, search]);

  useEffect(() => {
    if (!token) return;
    let timer;
    const load = async () => {
      try {
        const response = await fetch("/api/public/registrations/access/status", { credentials: "omit", headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Lien indisponible.");
        setData(payload);
        if (payload.registration.status === "PROCESSING") timer = window.setTimeout(load, 2000);
      } catch (reason) { setError(reason.message); }
    };
    load();
    return () => window.clearTimeout(timer);
  }, [token]);

  const download = async () => {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch("/api/public/registrations/access/download", { credentials: "omit", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const body = await response.json(); throw new Error(body.message || "Téléchargement impossible."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "pass-accessq.pdf"; anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(reason.message); }
    finally { setDownloading(false); }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950"><div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
    {!token ? <State icon={Mail} title="Lien manquant" text="Utilisez le lien reçu après votre inscription ou par email." /> : error ? <State icon={RotateCw} title="Accès impossible" text={error} /> : !data || data.registration.status === "PROCESSING" ? <State spin title="Création de votre pass" text="Cette page se met à jour automatiquement. Vous pouvez aussi la fermer : un lien vous sera envoyé par email." /> : data.registration.passAvailable ? <>
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500 dark:text-emerald-400" /><h1 className="mt-5 text-2xl font-black text-slate-950 dark:text-slate-50">Votre pass est prêt</h1><p className="mt-2 text-slate-600 dark:text-slate-300">{data.offer.name} · {data.event.title}</p>
      <button onClick={download} disabled={downloading} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">{downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} Télécharger le PDF</button>
      <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">Le lien est personnel, expirant et indépendant du QR de contrôle d’accès.</p>
    </> : <State icon={RotateCw} title="Traitement interrompu" text={data.registration.failureMessage || "L’organisateur peut relancer la création de votre pass."} />}
  </div></main>;
}

function State({ icon: Icon, spin, title, text }) { return <div className="py-8">{spin ? <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" /> : <Icon className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-400" />}<h1 className="mt-5 text-2xl font-black text-slate-950 dark:text-slate-50">{title}</h1><p className="mt-3 text-slate-600 dark:text-slate-300">{text}</p></div>; }
