"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CalendarPlus, CheckCircle2, Download, Loader2, MapPinned, Palette, Pencil, QrCode, TrendingUp, UserPlus, Users, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch, apiUrl, refreshSession } from "../lib/api";
import LoadingBar from "../components/LoadingBar";
import DismissiblePlanPromotion from "../components/DismissiblePlanPromotion";
import { useUserPlan } from "../lib/useUserPlan";

const ONBOARDING_STORAGE_KEY = "qrAccessDashboardOnboardingV2Dismissed";

const onboardingSteps = [
    {
        title: "Préparer les zones",
        description: "Définissez les entrées, salles ou espaces autorisés.",
        href: "/dashboard/areas",
        action: "Gérer les zones",
        icon: MapPinned
    },
    {
        title: "Créer un modèle",
        description: "Préparez votre carte en brouillon, vérifiez son aperçu puis publiez-la.",
        href: "/dashboard/card-templates",
        action: "Gérer les modèles",
        icon: Palette
    },
    {
        title: "Créer un événement",
        description: "Ajoutez le nom, la date et les accès à contrôler.",
        href: "/dashboard/events/new",
        action: "Nouvel événement",
        icon: CalendarPlus
    },
    {
        title: "Générer des QR codes",
        description: "Créez les accès pour vos invités ou participants.",
        href: "/dashboard/events",
        action: "Voir les événements",
        icon: QrCode
    },
    {
        title: "Inviter des agents",
        description: "Donnez accès aux personnes qui scanneront sur place.",
        href: "/dashboard/agents",
        action: "Ajouter un agent",
        icon: UserPlus
    }
];

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeQrs: 0,
        totalScans: 0,
        upcomingEvents: 0,
        nextEventTitle: "Aucun événement",
        activeAgents: 0,
        scansByDay: [],
        topAgents: [],
        recentScans: [],
        capabilities: { advancedAnalytics: false }
    });
    const [userName, setUserName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [toast, setToast] = useState({ show: false, message: "" });
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [exportingFormat, setExportingFormat] = useState("");
    const { userProfile, hasCapability, planName } = useUserPlan();
    const isAgent = userProfile?.role === "ORG_AGENT";
    const canExportScans = hasCapability("scan_exports");


    const handleExport = async (format) => {
        if (stats.totalScans === 0) {
            setToast({ show: true, message: "Aucune donnée de scan n'est disponible pour l'exportation." });
            setTimeout(() => setToast({ show: false, message: "" }), 4000);
            return;
        }
        setExportingFormat(format);
        try {
            const session = await refreshSession();
            if (!session.ok) return;
            window.open(apiUrl(`/export/${format}`), '_blank');
        } finally {
            setExportingFormat("");
        }
    };


    
    useEffect(() => {
        setShowOnboarding(localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true");

        const fetchDashboardData = async () => {
            try {
                // Fetch User Profile to get Name
                const profileRes = await apiFetch("/user/profile", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });
                const profileData = await profileRes.json();

                if (profileData.success && profileData.user) {
                    const fullName = profileData.user.name || profileData.user.full_name || "Admin";
                    setUserName(fullName.split(' ')[0]); // Get first name
                }

                // Fetch Dashboard Stats
                const statsRes = await apiFetch("/dashboard/stats", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });
                const statsData = await statsRes.json();

                if (statsData.success) {
                    setStats(statsData.data);
                } else {
                    setError("Impossible de charger les statistiques.");
                }
            } catch (err) {
                console.error("Dashboard Fetch Error:", err);
                setError("Erreur de connexion au serveur.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const dismissOnboarding = () => {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
        setShowOnboarding(false);
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
                    <p className="font-semibold text-lg">{error}</p>
                    <p className="text-sm mt-2">Veuillez vous assurer que vous êtes connecté.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="aq-page space-y-8">
            {/* **************************************** */}
            {/* En-tête du tableau de bord et actions d'export */}
            {/* **************************************** */}
            <div className="aq-page-header">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Centre de contrôle</p>
                        <h2 className="aq-page-title">Tableau de bord{userName ? `, ${userName}` : ""}</h2>
                        <p className="aq-page-subtitle">Suivi des accès, des scans et des agents de votre organisation.</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => handleExport('csv')}
                            disabled={exportingFormat === "csv" || !canExportScans}
                            className="aq-button-secondary"
                            title={!canExportScans ? "Disponible à partir du plan Essential" : "Exporter en CSV"}
                        >
                            {exportingFormat === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            CSV
                        </button>
                        <button 
                            onClick={() => handleExport('pdf')}
                            disabled={exportingFormat === "pdf" || !canExportScans}
                            className="aq-button-secondary"
                            title={!canExportScans ? "Disponible à partir du plan Essential" : "Exporter en PDF"}
                        >
                            {exportingFormat === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            PDF
                        </button>
                    </div>
                </div>
                {!canExportScans && !isAgent && (
                    <DismissiblePlanPromotion promotionId="dashboard-exports" userId={userProfile?.user_id} className="relative z-10 mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 pr-12 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        <span className="font-semibold">Plan {planName || "Découverte"}</span> · Passez à Essential ou Pro pour profiter des exports CSV et PDF.
                    </DismissiblePlanPromotion>
                )}
                {exportingFormat && (
                    <LoadingBar label={`Préparation export ${exportingFormat.toUpperCase()}`} className="relative z-10 mt-6" />
                )}
            </div>

            {/* **************************************** */}
            {/* Progression de la configuration initiale */}
            {/* **************************************** */}
            {stats.onboarding && !stats.onboarding.complete && (
                <section className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/20 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1"><p className="text-sm font-black text-blue-950 dark:text-blue-100">Configuration de votre organisation · {stats.onboarding.percentage}%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"><div className="h-full rounded-full bg-blue-600" style={{ width: `${stats.onboarding.percentage}%` }} /></div><p className="mt-2 text-xs text-blue-700 dark:text-blue-300">{stats.onboarding.completed} étape{stats.onboarding.completed > 1 ? "s" : ""} sur {stats.onboarding.total} terminée{stats.onboarding.completed > 1 ? "s" : ""}.</p></div>
                    <Link href="/dashboard/getting-started" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Continuer la configuration</Link>
                </section>
            )}

            {false && showOnboarding && (
                <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <button
                        type="button"
                        onClick={dismissOnboarding}
                        aria-label="Masquer le guide de démarrage"
                        className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="max-w-3xl pr-10">
                        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
                            <CheckCircle2 className="h-5 w-5" />
                            Guide de démarrage
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Bienvenue sur AccessQ</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Voici les premières actions utiles pour configurer votre organisation et commencer les contrôles.
                        </p>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        {onboardingSteps.map((step) => {
                            const Icon = step.icon;
                            return (
                                <div key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">{step.title}</h4>
                                    <p className="mt-2 min-h-12 text-sm leading-5 text-slate-500 dark:text-slate-400">{step.description}</p>
                                    <Link
                                        href={step.href}
                                        className="mt-4 inline-flex items-center text-sm font-bold text-blue-700 transition-colors hover:text-blue-600 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
                                    >
                                        {step.action}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
                        <div className="flex items-start gap-3">
                            <Pencil className="mt-0.5 h-5 w-5 flex-none text-amber-700 dark:text-amber-300" />
                            <div>
                                <h4 className="font-bold text-amber-950 dark:text-amber-100">Comment modifier un modèle ?</h4>
                                <div className="mt-3 grid gap-3 text-sm text-amber-900 dark:text-amber-200 md:grid-cols-3">
                                    <p><strong>1. Création :</strong> créez et personnalisez librement votre modèle.</p>
                                    <p><strong>2. Publication :</strong> rendez-le disponible lors de la génération des QR.</p>
                                    <p><strong>3. Évolution :</strong> ouvrez le modèle et modifiez-le directement, sans duplication obligatoire.</p>
                                </div>
                                <p className="mt-3 text-xs leading-5 text-amber-800 dark:text-amber-300">Les cartes déjà générées conservent leur apparence ; seuls les prochains supports utilisent les changements enregistrés.</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* **************************************** */}
            {/* Indicateurs clés */}
            {/* **************************************** */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* **************************************** */}
                {/* Indicateur des QR actifs */}
                {/* **************************************** */}
                <div className="aq-panel p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">QR actifs</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeQrs}</h4>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Disponibles pour le contrôle d'accès.</p>
                </div>

                {/* **************************************** */}
                {/* Indicateur des scans enregistrés */}
                {/* **************************************** */}
                <div className="aq-panel p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Scans enregistrés</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalScans}</h4>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total des contrôles effectués.</p>
                </div>

                {/* **************************************** */}
                {/* Indicateur des événements à venir */}
                {/* **************************************** */}
                <div className="aq-panel p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Événements à venir</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.upcomingEvents}</h4>
                        </div>
                    </div>
                    <div className="flex items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium truncate">Prochain : {stats.nextEventTitle}</span>
                    </div>
                </div>

                {/* **************************************** */}
                {/* Indicateur des agents actifs */}
                {/* **************************************** */}
                <div className="aq-panel p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Agents actifs</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeAgents}</h4>
                        </div>
                    </div>
                    <div className="flex items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Comptes autorisés à scanner.</span>
                    </div>
                </div>
            </div>

            {/* **************************************** */}
            {/* Graphique d'activité et classement des agents */}
            {/* **************************************** */}
            {stats.capabilities?.advancedAnalytics ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* **************************************** */}
                {/* Courbe d'activité des scans */}
                {/* **************************************** */}
                <div className="aq-panel lg:col-span-2 p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activité des scans</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Volume des contrôles sur les derniers jours.</p>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.scansByDay}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 12 }} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 12 }} 
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="scans" 
                                    stroke="#3b82f6" 
                                    strokeWidth={4} 
                                    dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                                    activeDot={{ r: 8 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* **************************************** */}
                {/* Classement des agents */}
                {/* **************************************** */}
                <div className="aq-panel p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Agents les plus actifs</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Classement par nombre de scans.</p>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-6">
                        {stats.topAgents && stats.topAgents.length > 0 ? (
                            stats.topAgents.map((agent, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                                            index === 0 ? 'bg-amber-100 text-amber-700' : 
                                            index === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'bg-orange-50 text-orange-700'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <span className="font-semibold text-slate-900 dark:text-white">{agent.name}</span>
                                    </div>
                                    <span className="px-3 py-1 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-800">
                                        {agent.count}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-slate-400 dark:text-slate-500 italic py-8">Aucun agent actif détecté.</p>
                        )}
                    </div>
                    <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Ces données sont rafraîchies en temps réel à chaque scan autorisé ou refusé.
                        </p>
                    </div>
                </div>
            </div>
            ) : (
                <DismissiblePlanPromotion promotionId="dashboard-advanced-statistics" userId={userProfile?.user_id} className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5 pr-12 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold">Statistiques avancées</h3>
                        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                            L’activité sur 7 jours et le classement des agents sont disponibles avec le plan Pro.
                        </p>
                    </div>
                    {!isAgent && (
                        <Link href="/dashboard/upgrade" className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700">
                            Découvrir Pro
                        </Link>
                    )}
                </DismissiblePlanPromotion>
            )}

            {/* **************************************** */}
            {/* Tableau des derniers scans */}
            {/* **************************************** */}
            <div className="aq-panel">
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Derniers scans</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-200 dark:border-slate-800">
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Code</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Événement / zone</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Agent</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Heure</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 text-sm">
                            {stats.recentScans && stats.recentScans.length > 0 ? (
                                stats.recentScans.map((scan) => (
                                    <tr key={scan.id} className="table-row-hover">
                                        <td className="px-8 py-4 font-medium text-slate-900 dark:text-white tracking-tight font-mono">{scan.code}</td>
                                        <td className="px-8 py-4">{scan.event}</td>
                                        <td className="px-8 py-4">{scan.agent}</td>
                                        <td className="px-8 py-4 text-slate-500 dark:text-slate-400">
                                            {new Date(scan.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${scan.status === 'authorized'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}>
                                                {scan.status === 'authorized' ? 'Autorisé' : 'Refusé'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-8 py-8 text-center text-slate-500 dark:text-slate-400 border-none">
                                        Aucun scan récent enregistré.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* **************************************** */}
            {/* Notification des actions utilisateur */}
            {/* **************************************** */}
            {toast.show && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="bg-slate-900 dark:bg-[#BED3C3] text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50 dark:border-slate-300 backdrop-blur-md">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <p className="text-sm font-bold tracking-tight">{toast.message}</p>
                        <button onClick={() => setToast({ show: false, message: "" })} className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors">
                            <Download className="w-4 h-4 rotate-45" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
