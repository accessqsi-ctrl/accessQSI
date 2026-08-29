"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, Loader2, MapPinned, Palette, Pencil, QrCode, UserPlus } from "lucide-react";
import { apiFetch } from "../../lib/api";

const steps = [
    {
        key: "areas",
        title: "Préparer les zones",
        description: "Transformez vos lieux physiques en points de contrôle clairement identifiés : entrée principale, salle VIP, parking, coulisses, bureaux ou toute autre zone sensible.",
        details: [
            "Chaque zone possède un niveau d’accréditation requis. Par exemple : niveau 1 pour l’accès général, niveau 2 pour un espace réservé et niveau 3 pour une zone sensible.",
            "La règle est simple : le niveau du QR doit être supérieur ou égal au niveau demandé par la zone. Un QR de niveau 3 peut donc ouvrir une zone de niveau 1, mais pas l’inverse.",
            "Lors du scan, AccessQ vérifie aussi que la zone appartient bien à l’événement et qu’elle est ouverte à l’heure du contrôle."
        ],
        outcome: "Vous obtenez une circulation organisée, des responsabilités claires et moins de décisions improvisées à l’entrée.",
        href: "/dashboard/areas",
        action: "Configurer les zones",
        icon: MapPinned
    },
    {
        key: "events",
        title: "Créer un événement",
        description: "Centralisez dans un même espace les dates, les horaires et les zones autorisées pour une cérémonie, une conférence, un concert ou une opération interne.",
        details: [
            "Associez uniquement les zones réellement utilisées afin que les agents voient immédiatement où ils peuvent contrôler les accès.",
            "Définissez une période de validité pour chaque zone : avant l’ouverture ou après la fermeture, le QR est automatiquement refusé.",
            "L’événement devient votre centre de pilotage pour générer les QR, suivre leur utilisation et consulter les décisions de contrôle."
        ],
        outcome: "Toute votre opération est structurée avant l’arrivée du premier invité, avec moins d’erreurs et une meilleure visibilité pour l’équipe.",
        href: "/dashboard/events/new",
        action: "Créer l’événement",
        icon: CalendarPlus
    },
    {
        key: "qrs",
        title: "Générer un QR",
        description: "Créez un accès unique pour chaque invité, collaborateur ou prestataire, avec les règles adaptées à son profil.",
        details: [
            "Renseignez le titulaire, son niveau d’accès, sa période de validité et son nombre de passages autorisés — unique, limité ou illimité selon le besoin.",
            "AccessQ utilise quatre statuts lisibles : Actif peut être scanné, Épuisé a consommé tous ses passages, Expiré a dépassé sa date de validité et Révoqué a été désactivé manuellement.",
            "Vous pouvez commencer avec les modèles standards AccessQ. La personnalisation avancée du support intervient à l’étape 5."
        ],
        outcome: "Chaque accès devient traçable, contrôlable et révocable sans refaire vos listes ni réimprimer toute votre organisation.",
        href: "/dashboard/events",
        action: "Générer les premiers QR",
        icon: QrCode
    },
    {
        key: "agents",
        title: "Inviter un agent",
        description: "Donnez à chaque membre de l’équipe exactement les outils dont il a besoin, sans lui ouvrir inutilement toute l’administration.",
        details: [
            "Administrateur : pilote l’organisation, les événements, les zones, les agents et les paramètres. C’est le rôle de supervision complète.",
            "Agent : scanne les accès, consulte les QR et peut en générer pour les événements auxquels il travaille. Il accompagne les opérations sans gérer les comptes de l’équipe.",
            "Opérateur : se concentre sur le contrôle terrain. Son espace est volontairement limité au scanner et à la sécurité de son propre compte."
        ],
        outcome: "Vous accélérez les contrôles tout en gardant une séparation nette des responsabilités et un meilleur niveau de sécurité.",
        href: "/dashboard/agents",
        action: "Composer l’équipe",
        icon: UserPlus
    },
    {
        key: "models",
        title: "Publier un modèle",
        description: "Finalisez l’expérience avec un billet, un badge ou une invitation qui porte réellement l’identité de votre organisation.",
        details: [
            "Créez d’abord le modèle en brouillon : choisissez son format, ses couleurs, ses textes, son visuel et la position du QR sans l’exposer aux utilisateurs.",
            "Contrôlez l’aperçu, puis publiez le modèle lorsqu’il est prêt. Seuls les modèles publiés peuvent être sélectionnés pour les nouveaux QR.",
            "Définissez votre meilleur modèle par défaut pour accélérer les prochaines générations. Les QR déjà créés conservent leur apparence enregistrée."
        ],
        outcome: "Votre contrôle d’accès devient aussi un support de marque professionnel, cohérent et immédiatement reconnaissable.",
        href: "/dashboard/card-templates",
        action: "Créer et publier",
        icon: Palette
    }
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

    return <div className="aq-page max-w-5xl space-y-7">
        {/* **************************************** */}
        {/* En-tête du parcours de démarrage */}
        {/* **************************************** */}
        <header className="aq-page-header"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Configuration de l’organisation</p><h1 className="aq-page-title">Lancez votre premier contrôle avec confiance</h1><p className="aq-page-subtitle">Cinq étapes guidées pour structurer vos lieux, préparer votre événement, sécuriser chaque QR et mobiliser une équipe parfaitement informée.</p></div></header>
        {/* **************************************** */}
        {/* Liste des étapes de configuration */}
        {/* **************************************** */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between"><strong className="text-slate-900 dark:text-white">{progress.completed} étape{progress.completed > 1 ? "s" : ""} sur {progress.total}</strong><span className="text-sm font-black text-blue-600">{progress.percentage}%</span></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all dark:bg-gradient-to-r dark:from-blue-600 dark:to-emerald-500" style={{ width: `${progress.percentage}%` }} /></div>
        </section>
        <div className="space-y-4">{steps.map((step, index) => { const Icon = step.icon; const done = progress.steps[step.key]; return <article key={step.key} className={`rounded-2xl border p-5 sm:p-6 ${done ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/15" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${done ? "bg-emerald-600 text-white" : "bg-blue-50 text-blue-700 dark:bg-blue-950"}`}>{done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-400">Étape {index + 1}</p>
                        {done && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Terminée</span>}
                    </div>
                    <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{step.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                    <ul className="mt-4 space-y-2.5">
                        {step.details.map(detail => <li key={detail} className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-400"><span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-slate-900 dark:bg-slate-300" /><span>{detail}</span></li>)}
                    </ul>
                    <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:text-slate-300"><strong className="font-black text-slate-900 dark:text-white">Le bénéfice AccessQ : </strong>{step.outcome}</p>
                </div>
                <Link href={step.href} className="inline-flex flex-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-950">{done ? "Revoir cette étape" : step.action}<ArrowRight className="h-4 w-4" /></Link>
            </div>
        </article>; })}</div>
       </div>;
}
