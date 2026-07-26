"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Crown, Sparkles, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { useUserPlan } from "../../lib/useUserPlan";

const proFeatures = [
    {
        title: "Exports avancés",
        description: "Exportez vos données en CSV et PDF avec un rendu prêt à partager.",
        icon: TrendingUp
    },
    {
        title: "Imports CSV et traitements massifs",
        description: "Importez vos participants et gérez plusieurs accès en une seule opération.",
        icon: Zap
    },
    {
        title: "Modèles de cartes personnalisés",
        description: "Créez, dupliquez et publiez vos propres modèles avec une identité forte.",
        icon: Sparkles
    },
    {
        title: "Agents les plus actifs",
        description: "Analysez les agents qui génèrent le plus d’activité et identifiez rapidement les plus engagés.",
        icon: ShieldCheck
    },
    {
        title: "Activité des scans",
        description: "Suivez l’historique et les tendances de scans pour piloter vos événements avec plus de précision.",
        icon: TrendingUp
    },
    {
        title: "Sécurité et gouvernance",
        description: "Bénéficiez d’un accompagnement plus complet et d’un meilleur contrôle de vos accès.",
        icon: ShieldCheck
    }
];

export default function UpgradePage() {
    const { isFreePlan, planName } = useUserPlan();

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="grid gap-8 p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
                    <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                            <Crown className="h-4 w-4" />
                            Upgrade vers Pro
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                                Débloquez une meilleure expérience AccessQ avec le plan Pro
                            </h1>
                            <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                                Passez en Pro pour libérer les fonctionnalités les plus utiles à la gestion de vos accès, exports et templates personnalisés.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="mailto:contact@qraccess.com?subject=Demande%20d%27acc%C3%A8s%20Pro&body=Bonjour%2C%20je%20souhaite%20passer%20en%20version%20Pro%20pour%20b%C3%A9n%C3%A9ficier%20de%20l%27ensemble%20des%20fonctionnalit%C3%A9s.%20"
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                Demander l’accès Pro
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                           
                        </div>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 dark:border-blue-900/50 dark:bg-blue-950/20">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Plan actuel</p>
                        <div className="mt-4 flex items-center gap-3">
                            <div className="rounded-full bg-white p-2 text-blue-600 shadow-sm dark:bg-slate-900">
                                <Crown className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">{planName || "Free"}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    {isFreePlan ? "Votre organisation bénéficie du plan gratuit aujourd’hui." : "Vous avez déjà accès aux avantages Pro."}
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 rounded-xl border border-blue-200 bg-white/70 p-4 text-sm text-slate-700 dark:border-blue-900/50 dark:bg-slate-900/60 dark:text-slate-200">
                            <p className="font-semibold">Pourquoi passer en Pro ?</p>
                            <ul className="mt-3 space-y-2">
                                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> Plus de contrôle sur les événements et les accès.</li>
                                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> Des exports et imports plus rapides pour vos équipes.</li>
                                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> Un branding plus fort avec des templates personnalisés.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
                {proFeatures.map((feature) => {
                    const Icon = feature.icon;
                    return (
                        <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                <Icon className="h-5 w-5" />
                            </div>
                            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}
