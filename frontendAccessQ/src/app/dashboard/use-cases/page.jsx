"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Camera, CalendarClock, Dumbbell, HandHeart, Heart, Layers, Lightbulb, Music, Presentation, Repeat } from "lucide-react";

const accessLabels = {
    single: "Simple · 1 passage",
    multi: (limit) => `Multiple · ${limit} passages`,
    unlimited: "Illimité"
};

const formatAccess = (pass) => {
    const base = pass.access === "multi" ? accessLabels.multi(pass.limit) : accessLabels[pass.access];
    return pass.period ? `${base}, max ${pass.period}` : base;
};

const useCases = [
    {
        key: "wedding",
        title: "Mariage et cérémonie",
        audience: "Mariages, baptêmes, galas, anniversaires",
        image: "/accessq-mariage.webp",
        imageAlt: "Salle de réception décorée pour un mariage",
        icon: Heart,
        pitch: "Chaque invitation devient nominative : une invitation transférée ou photocopiée ne passe qu’une fois, et les espaces réservés à la famille restent réservés.",
        event: "« Mariage de Sarah et David » sur la journée de la cérémonie.",
        zones: [
            { name: "Accueil de la réception", level: 1 },
            { name: "Espace famille et table d’honneur", level: 2 }
        ],
        passes: [
            { profile: "Invité", level: 1, access: "single", validity: "Jour de la cérémonie" },
            { profile: "Famille proche", level: 2, access: "multi", limit: 3, validity: "Jour de la cérémonie" },
            { profile: "Prestataire (traiteur, DJ)", level: 2, access: "unlimited", validity: "Jour de la cérémonie", photo: true }
        ],
        tips: [
            "Utilisez un modèle d’invitation recto-verso : le QR au recto, le programme ou le plan d’accès au verso.",
            "Un opérateur par entrée suffit : son espace est limité au scanner, il ne voit pas la liste des invités.",
            "Une invitation perdue ? Révoquez-la et générez-en une nouvelle : l’ancienne sera refusée au scan."
        ]
    },
    {
        key: "conference",
        title: "Conférence et séminaire",
        audience: "Congrès, salons, formations sur plusieurs jours",
        image: "/accessq-conference.webp",
        imageAlt: "Conférence professionnelle organisée dans une grande salle",
        icon: Presentation,
        pitch: "Un badge par participant pour toute la durée de l’événement, des ateliers réservés aux offres premium et un ticket repas qui ne sert qu’une fois par jour.",
        event: "« Forum 2026 » du premier au dernier jour, avec un créneau horaire par zone.",
        zones: [
            { name: "Accueil et salle plénière", level: 1 },
            { name: "Restauration", level: 1 },
            { name: "Ateliers premium", level: 2 },
            { name: "Espace intervenants", level: 3 }
        ],
        passes: [
            { profile: "Participant standard", level: 1, access: "unlimited", validity: "Durée de la conférence" },
            { profile: "Participant premium", level: 2, access: "unlimited", validity: "Durée de la conférence" },
            { profile: "Intervenant", level: 3, access: "unlimited", validity: "Durée de la conférence", photo: true },
            { profile: "Ticket repas", level: 1, access: "unlimited", period: "1 par jour", validity: "Durée de la conférence" }
        ],
        tips: [
            "Importez la liste des participants depuis un fichier CSV plutôt que de saisir chaque QR.",
            "Le ticket repas n’est scanné qu’à l’entrée de la restauration : la limite se réinitialise chaque jour à minuit, heure locale.",
            "Fermez les zones en dehors de leurs horaires : un badge valide sera tout de même refusé avant l’ouverture."
        ]
    },
    {
        key: "concert",
        title: "Concert et festival",
        audience: "Concerts, festivals, matchs, spectacles",
        image: "/accessq-concert.webp",
        imageAlt: "Public réuni lors d’un concert",
        icon: Music,
        pitch: "Des billets à usage unique pour le public, des sorties et retours maîtrisés pour le carré VIP et un backstage réservé aux équipes identifiées.",
        event: "« Festival d’été » sur les jours de montage, de représentation et de démontage.",
        zones: [
            { name: "Entrée générale et fosse", level: 1 },
            { name: "Carré Or", level: 2 },
            { name: "Backstage", level: 3 }
        ],
        passes: [
            { profile: "Billet standard", level: 1, access: "single", validity: "Jour du concert" },
            { profile: "Billet Carré Or", level: 2, access: "multi", limit: 2, validity: "Jour du concert" },
            { profile: "Staff et artistes", level: 3, access: "unlimited", validity: "Montage au démontage", photo: true }
        ],
        tips: [
            "Créez une zone par porte d’entrée : l’historique des scans montre alors l’affluence de chaque accès.",
            "La photo du titulaire s’affiche sur le téléphone de l’agent : un badge staff prêté est repéré immédiatement.",
            "Donnez le rôle Opérateur aux agents de sécurité : leur espace se limite au scanner."
        ]
    },
    {
        key: "company",
        title: "Entreprise et site privé",
        audience: "Bureaux, entrepôts, chantiers, visiteurs",
        image: "/accessq-carte-access.webp",
        imageAlt: "Carte d’accès avec QR code",
        icon: Building2,
        pitch: "Remplacez les badges papier par des accès nominatifs avec photo, valables le temps d’un contrat ou d’une visite, et révocables en un clic.",
        event: "Un événement permanent, par exemple « Siège social 2026 », renouvelé chaque année.",
        zones: [
            { name: "Hall d’accueil", level: 1 },
            { name: "Bureaux", level: 2 },
            { name: "Salle serveurs et archives", level: 3 }
        ],
        passes: [
            { profile: "Collaborateur", level: 2, access: "unlimited", validity: "Durée du contrat", photo: true },
            { profile: "Visiteur", level: 1, access: "single", validity: "Journée de la visite" },
            { profile: "Prestataire", level: 2, access: "unlimited", period: "1 par jour", validity: "Durée de la mission", photo: true },
            { profile: "Équipe technique", level: 3, access: "unlimited", validity: "Durée du contrat", photo: true }
        ],
        tips: [
            "Révoquez le QR le jour du départ d’un collaborateur : l’accès est coupé sans récupérer de badge physique.",
            "Un modèle de badge recto-verso avec la photo du titulaire rend le contrôle visuel immédiat.",
            "Définissez les horaires d’ouverture de chaque zone pour refuser automatiquement les accès de nuit."
        ]
    },
    {
        key: "membership",
        title: "Abonnement et club",
        audience: "Salles de sport, piscines, clubs, bibliothèques",
        icon: Dumbbell,
        pitch: "Un QR par abonné, valable le temps de l’abonnement, limité à une entrée par jour et protégé par la photo du titulaire contre le prêt de carte.",
        event: "Une saison, par exemple « Saison 2026-2027 ».",
        zones: [
            { name: "Accueil", level: 1 },
            { name: "Espace premium (sauna, coaching)", level: 2 }
        ],
        passes: [
            { profile: "Abonné standard", level: 1, access: "unlimited", period: "1 par jour", validity: "Durée de l’abonnement", photo: true },
            { profile: "Abonné premium", level: 2, access: "unlimited", period: "1 par jour", validity: "Durée de l’abonnement", photo: true },
            { profile: "Carte 10 séances", level: 1, access: "multi", limit: 10, validity: "6 mois" }
        ],
        tips: [
            "Carte de séances épuisée ? Rechargez-la au lieu d’en créer une nouvelle : l’historique des passages est conservé.",
            "La limite « 1 par jour » se réinitialise à minuit, heure locale : un abonné refusé voit à quel moment il pourra revenir.",
            "Un abonnement résilié ? Révoquez le QR : il est refusé dès le scan suivant."
        ]
    },
    {
        key: "distribution",
        title: "Distribution et cantine",
        audience: "ONG, aide alimentaire, restauration collective",
        icon: HandHeart,
        pitch: "Chaque bénéficiaire reçoit sa part, une seule fois par période, et chaque distribution est tracée pour vos rapports.",
        event: "La durée du programme, par exemple « Programme d’aide T1 ».",
        zones: [
            { name: "Point de distribution", level: 1 }
        ],
        passes: [
            { profile: "Bénéficiaire", level: 1, access: "unlimited", period: "1 par semaine", validity: "Durée du programme", photo: true },
            { profile: "Repas cantine", level: 1, access: "unlimited", period: "1 par jour", validity: "Année scolaire" }
        ],
        tips: [
            "La photo permet de vérifier que le bénéficiaire est bien le titulaire du QR, sans papier d’identité.",
            "Un refus « limite atteinte » indique précisément quand le prochain passage sera autorisé.",
            "Exportez l’historique des scans pour vos rapports aux bailleurs, selon les options de votre abonnement."
        ]
    }
];

const reminders = [
    { icon: Layers, title: "Niveau", text: "Le niveau du QR doit être supérieur ou égal à celui de la zone." },
    { icon: Repeat, title: "Passages", text: "Simple, multiple ou illimité ; un QR multiple peut être rechargé." },
    { icon: CalendarClock, title: "Limite par période", text: "Plafonne les passages par jour, semaine ou mois." },
    { icon: Camera, title: "Photo", text: "Affichée à l’agent au scan pour éviter les prêts de QR." }
];

export default function UseCasesPage() {
    const [selectedKey, setSelectedKey] = useState(useCases[0].key);
    const selected = useCases.find(useCase => useCase.key === selectedKey);
    const SelectedIcon = selected.icon;

    return <div className="aq-page max-w-6xl space-y-7">
        {/* **************************************** */}
        {/* En-tête des cas d’utilisation */}
        {/* **************************************** */}
        <header className="aq-page-header"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Cas d’utilisation</p><h1 className="aq-page-title">Partez d’une configuration éprouvée</h1><p className="aq-page-subtitle">Choisissez la situation la plus proche de la vôtre : zones, niveaux, passages et validité recommandés pour chaque profil, à reproduire ou à adapter.</p></div></header>

        {/* **************************************** */}
        {/* Sélection du scénario */}
        {/* **************************************** */}
        <div role="tablist" aria-label="Scénarios" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {useCases.map(useCase => {
                const Icon = useCase.icon;
                const active = useCase.key === selectedKey;
                return <button key={useCase.key} type="button" role="tab" aria-selected={active} aria-controls="use-case-panel" onClick={() => setSelectedKey(useCase.key)} className={`flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? "border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/40" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"}`}>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}><Icon className="h-5 w-5" /></span>
                    <span className={`text-sm font-black leading-5 ${active ? "text-blue-900 dark:text-blue-100" : "text-slate-800 dark:text-slate-100"}`}>{useCase.title}</span>
                </button>;
            })}
        </div>

        {/* **************************************** */}
        {/* Configuration recommandée du scénario */}
        {/* **************************************** */}
        <section id="use-case-panel" role="tabpanel" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="grid lg:grid-cols-[1fr_20rem]">
                <div className="p-6 sm:p-8">
                    <div className="flex items-center gap-3">
                        <SelectedIcon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{selected.audience}</p>
                    </div>
                    <h2 className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{selected.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.pitch}</p>
                    <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300"><strong className="font-black text-slate-900 dark:text-white">Événement : </strong>{selected.event}</p>
                </div>
                {selected.image && <img src={selected.image} alt={selected.imageAlt} className="hidden h-full w-full object-cover lg:block" />}
            </div>

            <div className="grid gap-6 border-t border-slate-200 p-6 dark:border-slate-800 sm:p-8 lg:grid-cols-[16rem_1fr]">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">1. Zones à créer</h3>
                    <ul className="mt-3 space-y-2">
                        {selected.zones.map(zone => <li key={zone.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-800"><span className="font-semibold text-slate-800 dark:text-slate-100">{zone.name}</span><span className="flex-none rounded-full bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">Niv. {zone.level}</span></li>)}
                    </ul>
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">2. QR à générer par profil</h3>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                <tr><th className="px-4 py-3">Profil</th><th className="px-4 py-3">Niveau</th><th className="px-4 py-3">Passages</th><th className="px-4 py-3">Validité</th><th className="px-4 py-3">Photo</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {selected.passes.map(pass => <tr key={pass.profile} className="text-slate-700 dark:text-slate-300">
                                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{pass.profile}</td>
                                    <td className="px-4 py-3">{pass.level}</td>
                                    <td className="px-4 py-3">{formatAccess(pass)}</td>
                                    <td className="px-4 py-3">{pass.validity}</td>
                                    <td className="px-4 py-3">{pass.photo ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300"><Camera className="h-3.5 w-3.5" />Oui</span> : <span className="text-slate-400">Facultative</span>}</td>
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-200 p-6 dark:border-slate-800 sm:p-8">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"><Lightbulb className="h-4 w-4 text-amber-500" />Conseils terrain</h3>
                <ul className="mt-3 grid gap-3 md:grid-cols-3">
                    {selected.tips.map(tip => <li key={tip} className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">{tip}</li>)}
                </ul>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link href="/dashboard/areas" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/60">Créer les zones</Link>
                    <Link href="/dashboard/events/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Créer l’événement<ArrowRight className="h-4 w-4" /></Link>
                </div>
            </div>
        </section>

        {/* **************************************** */}
        {/* Rappel des règles de contrôle */}
        {/* **************************************** */}
        <section>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Les réglages à combiner</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {reminders.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    <p className="mt-3 font-black text-slate-900 dark:text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p>
                </div>)}
            </div>
        </section>
    </div>;
}
