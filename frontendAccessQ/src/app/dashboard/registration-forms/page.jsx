"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { apiFetch } from "../../lib/api";

export default function RegistrationFormsPage() {
  const [forms, setForms] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { apiFetch("/registration-forms").then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message); setForms(data.forms || []); }).catch(reason => setError(reason.message || "Chargement impossible." )).finally(() => setLoading(false)); }, []);
  return <div className="aq-page space-y-6"><div className="aq-page-header"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Inscription autonome</p><h1 className="aq-page-title">Formulaires d’inscription</h1><p className="aq-page-subtitle">Publiez des offres gratuites et suivez l’émission des pass.</p></div><Link href="/dashboard/registration-forms/new" className="aq-button-primary"><Plus className="h-5 w-5" /> Nouveau</Link></div>
    <div className="aq-panel overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="aq-table-head"><th className="px-6 py-4">Formulaire</th><th>Événement</th><th>Statut</th><th>Inscriptions</th><th></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{loading ? <tr><td colSpan="5" className="p-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" /></td></tr> : forms.length ? forms.map(form => <tr key={form.id}><td className="px-6 py-4 font-bold text-slate-950 dark:text-slate-50">{form.title}</td><td>{form.event?.title}</td><td><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold dark:bg-slate-800 dark:text-slate-200">{form.status}</span></td><td>{form.registrationCount || 0}</td><td><Link className="font-bold text-blue-700 dark:text-blue-300" href={`/dashboard/registration-forms/${form.id}`}>Gérer</Link></td></tr>) : <tr><td colSpan="5" className="p-10 text-center text-slate-500 dark:text-slate-400"><ClipboardList className="mx-auto mb-3 h-10 w-10" />Aucun formulaire.</td></tr>}</tbody></table></div>{error && <p className="text-red-600 dark:text-red-400">{error}</p>}
  </div>;
}
