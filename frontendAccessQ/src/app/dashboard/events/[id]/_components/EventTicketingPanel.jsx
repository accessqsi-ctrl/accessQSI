"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ClipboardList, Copy, Plus } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

const STATUS = {
  DRAFT: ["Brouillon", "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"],
  PUBLISHED: ["En ligne", "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
  CLOSED: ["Fermé", "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"]
};

// Formulaires d'inscription et billetterie de l'événement : ils se créent ici et partagent le quota de QR de l'événement.
export default function EventTicketingPanel({ eventId }) {
  const [forms, setForms] = useState(null);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    apiFetch(`/registration-forms?eventId=${encodeURIComponent(eventId)}`)
      .then(async response => { const data = await response.json(); setForms(response.ok ? data.forms || [] : []); })
      .catch(() => setForms([]));
  }, [eventId]);
  const copy = async form => {
    await navigator.clipboard.writeText(`${window.location.origin}/register/${form.publicSlug}`);
    setCopied(form.id);
    window.setTimeout(() => setCopied(""), 2000);
  };
  return <div className="aq-panel">
    <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Billetterie et inscriptions</h2><p className="text-sm text-slate-500 dark:text-slate-400">Partagez un lien pour que les participants obtiennent leur billet eux-mêmes.</p></div>
      <Link href={`/dashboard/registration-forms/new?eventId=${encodeURIComponent(eventId)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"><Plus className="h-4 w-4" /> Créer un formulaire</Link>
    </div>
    {forms === null ? <p className="px-6 py-5 text-sm text-slate-500 dark:text-slate-400">Chargement…</p>
      : forms.length === 0 ? <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400"><ClipboardList className="mx-auto mb-2 h-8 w-8" />Aucun formulaire pour cet événement.</div>
      : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{forms.map(form => {
        const [label, tone] = STATUS[form.status] || [form.status, STATUS.DRAFT[1]];
        return <li key={form.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-slate-100">{form.title}</p><p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className={`rounded-full px-2 py-0.5 font-bold ${tone}`}>{label}</span>{form.registrationCount || 0} inscription(s)</p></div>
          <div className="flex shrink-0 gap-2">
            {form.status === "PUBLISHED" && <button type="button" onClick={() => copy(form)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800">{copied === form.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied === form.id ? "Lien copié" : "Copier le lien"}</button>}
            <Link href={`/dashboard/registration-forms/${form.id}`} className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-slate-800">Gérer</Link>
          </div>
        </li>;
      })}</ul>}
  </div>;
}
