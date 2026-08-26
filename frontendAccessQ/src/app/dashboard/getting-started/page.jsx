"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, Loader2, MapPinned, Palette, Pencil, QrCode, UserPlus } from "lucide-react";
import { apiFetch } from "../../lib/api";

const steps = [
    { key: "areas", title: "Préparer les zones", description: "Définissez les entrées, salles ou espaces contrôlés.", href: "/dashboard/areas", action: "Gérer les zones", icon: MapPinned },
    { key: "models", title: "Publier un modèle", description: "Créez une carte en brouillon, contrôlez l’aperçu puis publiez-la.", href: "/dashboard/card-templates", action: "Créer un modèle", icon: Palette },
    { key: "events", title: "Créer un événement", description: "Ajoutez les dates et associez les zones concernées.", href: "/dashboard/events/new", action: "Nouvel événement", icon: CalendarPlus },
    { key: "qrs", title: "Générer un QR", description: "Créez le premier accès avec votre modèle publié.", href: "/dashboard/events", action: "Voir les événements", icon: QrCode },
    { key: "agents", title: "Inviter un agent", description: "Ajoutez une personne chargée du contrôle sur place.", href: "/dashboard/agents", action: "Gérer les agents", icon: UserPlus }
];

export default function GettingStartedPage() {
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState("");
    useEffect(() => {
        apiFetch("/dashboard/onboarding").then(response => response.json()).then(data => {
            if (!data.success) throw new Error(data.message);
            setProgress(data.data);
        }).catch(() => setError("Impossible de charger votre progression."));
    }, []);

    if (!progress && !error) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-blue-600" /></div>;
    if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>;

    return <div className="mx-auto max-w-5xl space-y-7">
        {/* **************************************** */}
        {/* En-tête du parcours de démarrage */}
        {/* **************************************** */}
        <header><p className="text-sm font-bold text-blue-600">Configuration de l’organisation</p><h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Premiers pas</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Suivez ces étapes pour préparer votre premier contrôle d’accès.</p></header>
        {/* **************************************** */}
        {/* Liste des étapes de configuration */}
        {/* **************************************** */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between"><strong className="text-slate-900 dark:text-white">{progress.completed} étape{progress.completed > 1 ? "s" : ""} sur {progress.total}</strong><span className="text-sm font-black text-blue-600">{progress.percentage}%</span></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all" style={{ width: `${progress.percentage}%` }} /></div>
        </section>
        <div className="space-y-3">{steps.map((step, index) => { const Icon = step.icon; const done = progress.steps[step.key]; return <article key={step.key} className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center ${done ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/15" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}>
            <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${done ? "bg-emerald-600 text-white" : "bg-blue-50 text-blue-700 dark:bg-blue-950"}`}>{done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div>
            <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Étape {index + 1}</p><h2 className="font-black text-slate-900 dark:text-white">{step.title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{done ? "Étape terminée." : step.description}</p></div>
            <Link href={step.href} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-950">{done ? "Consulter" : step.action}<ArrowRight className="h-4 w-4" /></Link>
        </article>; })}</div>
       </div>;
}
