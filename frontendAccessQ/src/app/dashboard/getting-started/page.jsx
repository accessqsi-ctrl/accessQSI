"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Clock, Lightbulb, Loader2, PartyPopper, ScanLine } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { getNextOnboardingStep, getVisibleOnboardingSteps } from "../../lib/onboardingSteps";

const REGISTRATION_FORMS_ENABLED = process.env.NEXT_PUBLIC_REGISTRATION_FORMS_ENABLED === "true";

export default function GettingStartedPage() {
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState("");
    // null = étape suivante ouverte par défaut ; "" = tout est replié.
    const [openKey, setOpenKey] = useState(null);
    useEffect(() => {
        apiFetch("/dashboard/onboarding").then(response => response.json()).then(data => {
            if (!data.success) throw new Error(data.message);
            setProgress(data.data);
        }).catch(() => setError("Impossible de charger votre progression."));
    }, []);

    if (!progress && !error) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-blue-600" /></div>;
    if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300">{error}</div>;

    const steps = getVisibleOnboardingSteps(progress);
    const nextStep = getNextOnboardingStep(progress);
    const expandedKey = openKey ?? nextStep?.key ?? "";
    const toggleStep = (key) => setOpenKey(expandedKey === key ? "" : key);

    return <div className="aq-page max-w-5xl space-y-7">
        {/* **************************************** */}
        {/* En-tête du parcours de démarrage */}
        {/* **************************************** */}
        <header className="aq-page-header"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Configuration de l’organisation</p><h1 className="aq-page-title">Lancez votre premier contrôle avec confiance</h1><p className="aq-page-subtitle">Un parcours guidé adapté à votre abonnement pour préparer l’événement{REGISTRATION_FORMS_ENABLED ? ", publier les inscriptions" : ""}, sécuriser les accès et mobiliser votre équipe.</p></div></header>

        {/* **************************************** */}
        {/* Progression et prochaine action recommandée */}
        {/* **************************************** */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between"><strong className="text-slate-900 dark:text-white">{progress.completed} étape{progress.completed > 1 ? "s" : ""} sur {progress.total}</strong><span className="text-sm font-black text-blue-600">{progress.percentage}%</span></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all dark:bg-gradient-to-r dark:from-blue-600 dark:to-emerald-500" style={{ width: `${progress.percentage}%` }} /></div>
            <ol className="mt-5 flex flex-wrap gap-2" aria-label="Étapes de configuration">
                {steps.map((step, index) => {
                    const done = progress.steps[step.key];
                    const current = step.key === nextStep?.key;
                    return <li key={step.key}><button type="button" onClick={() => setOpenKey(step.key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${done ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300" : current ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200" : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"}`}>{done ? <Check className="h-3.5 w-3.5" /> : <span>{index + 1}</span>}{step.title}</button></li>;
                })}
            </ol>
            {nextStep ? (
                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Prochaine étape · environ {nextStep.duration}</p>
                        <p className="mt-1 font-black text-blue-950 dark:text-blue-100">{nextStep.title}</p>
                        <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">{nextStep.summary}</p>
                    </div>
                    <Link href={nextStep.href} className="inline-flex flex-none items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950">{nextStep.action}<ArrowRight className="h-4 w-4" /></Link>
                </div>
            ) : (
                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:flex-row sm:items-center">
                    <PartyPopper className="h-8 w-8 flex-none text-emerald-600 dark:text-emerald-300" />
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-emerald-950 dark:text-emerald-100">Votre organisation est prête</p>
                        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">Toutes les étapes sont terminées. Faites un scan d’essai avec un QR de test avant l’ouverture des portes.</p>
                    </div>
                    <Link href="/scan" className="inline-flex flex-none items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><ScanLine className="h-4 w-4" />Ouvrir le scanner</Link>
                </div>
            )}
        </section>

        {/* **************************************** */}
        {/* Liste des étapes de configuration */}
        {/* **************************************** */}
        <div className="space-y-3">{steps.map((step, index) => {
            const Icon = step.icon;
            const done = progress.steps[step.key];
            const current = step.key === nextStep?.key;
            const expanded = expandedKey === step.key;
            const panelId = `onboarding-step-${step.key}`;
            return <article key={step.key} className={`rounded-2xl border transition-colors ${done ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/15" : current ? "border-blue-300 bg-white shadow-sm dark:border-blue-800 dark:bg-slate-950" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}>
                <button type="button" onClick={() => toggleStep(step.key)} aria-expanded={expanded} aria-controls={panelId} className="flex w-full items-center gap-4 rounded-2xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-6">
                    <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${done ? "bg-emerald-600 text-white" : current ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`}>{done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Étape {index + 1}</p>
                            {done && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Terminée</span>}
                            {current && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">À faire maintenant</span>}
                            {!done && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Clock className="h-3 w-3" />{step.duration}</span>}
                        </div>
                        <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{step.title}</h2>
                        {!expanded && <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{step.summary}</p>}
                    </div>
                    <ChevronDown className={`h-5 w-5 flex-none text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && <div id={panelId} className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-start sm:px-6 sm:pb-6 sm:pl-[5.25rem]">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                        <ul className="mt-4 space-y-2.5">
                            {step.details.map(detail => <li key={detail} className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-400"><span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-slate-900 dark:bg-slate-300" /><span>{detail}</span></li>)}
                        </ul>
                        <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:text-slate-300"><strong className="font-black text-slate-900 dark:text-white">Le bénéfice accessQ : </strong>{step.outcome}</p>
                    </div>
                    <Link href={step.href} className={`inline-flex flex-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${current ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-200"}`}>{done ? "Revoir cette étape" : step.action}<ArrowRight className="h-4 w-4" /></Link>
                </div>}
            </article>;
        })}</div>

        {/* **************************************** */}
        {/* Renvoi vers les configurations types */}
        {/* **************************************** */}
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20 sm:flex-row sm:items-center">
            <Lightbulb className="h-7 w-7 flex-none text-amber-600 dark:text-amber-300" />
            <div className="min-w-0 flex-1">
                <p className="font-black text-amber-950 dark:text-amber-100">Vous ne savez pas quels niveaux ou quelles limites choisir ?</p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">Inspirez-vous des configurations prêtes à l’emploi : mariage, conférence, concert, entreprise, abonnement ou distribution.</p>
            </div>
            <Link href="/dashboard/use-cases" className="inline-flex flex-none items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40">Voir les cas d’utilisation<ArrowRight className="h-4 w-4" /></Link>
        </section>
    </div>;
}
