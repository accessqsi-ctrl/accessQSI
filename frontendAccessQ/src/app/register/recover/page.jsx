"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Mail } from "lucide-react";

export default function RecoverPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 p-12 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">Chargement…</main>}><RecoverContent /></Suspense>;
}

function RecoverContent() {
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const submit = async event => {
    event.preventDefault();
    await fetch("/api/public/registrations/recover", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, formSlug: search.get("form") || "" }) });
    setMessage("Si des pass correspondent, de nouveaux liens seront envoyés.");
  };
  return <main className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_38%)] px-4 py-12 dark:bg-slate-950 dark:bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_42%)]"><form onSubmit={submit} className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30"><Mail className="h-10 w-10 text-blue-600 dark:text-blue-400" /><h1 className="mt-4 text-2xl font-black text-slate-950 dark:text-slate-50">Retrouver mes pass</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Nous enverrons un nouveau lien à l’adresse enregistrée.</p><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="vous@exemple.com" className="mt-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900/60" /><button className="mt-3 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">Envoyer les liens</button>{message && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:border dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</p>}</form></main>;
}
