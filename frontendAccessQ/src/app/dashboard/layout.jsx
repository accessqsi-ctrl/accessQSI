"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Crown, Mail, Menu, X } from "lucide-react";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../lib/api";
import { useUserPlan } from "../lib/useUserPlan";

export default function DashboardLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const { userProfile, profileLoading, isProPlan, planName } = useUserPlan();
    const isOperator = userProfile?.role === "OPERATOR";
    const isAgent = userProfile?.role === "ORG_AGENT";
    const operatorAllowedPath = pathname === "/dashboard/settings";
    const agentRestrictedPath = pathname === "/dashboard/upgrade" || pathname.startsWith("/dashboard/upgrade/");

    useEffect(() => {
        const timer = window.setTimeout(() => setIsMobileNavOpen(false), 0);
        return () => window.clearTimeout(timer);
    }, [pathname]);

    useEffect(() => {
        if (!profileLoading && isOperator && !operatorAllowedPath) {
            router.replace("/scan");
        }
    }, [isOperator, operatorAllowedPath, profileLoading, router]);

    useEffect(() => {
        if (!profileLoading && isAgent && agentRestrictedPath) {
            router.replace("/dashboard");
        }
    }, [agentRestrictedPath, isAgent, profileLoading, router]);

    const handleLogout = async () => {
        try {
            const res = await apiFetch("/user/logout");
            if (res.ok) {
                router.push("/login");
            }
        } catch (err) {
            console.error("Error during logout:", err);
        }
    };

    const navigation = useMemo(() => {
        const items = [
            { name: "Tableau de bord", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
            { name: "Premiers pas", href: "/dashboard/getting-started", icon: "M12 6V4m0 2a6 6 0 00-6 6v3l-2 3h16l-2-3v-3a6 6 0 00-6-6zm-2 15h4" },
            { name: "Événements", href: "/dashboard/events", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
            { name: "Modèles", href: "/dashboard/card-templates", icon: "M7 3h7l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z M14 3v6h5 M8 14h8 M8 18h5" },
            { name: "Agents", href: "/dashboard/agents", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
            { name: "Zones", href: "/dashboard/areas", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
            { name: "Scanner", href: "/scan", icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z", special: true },
            { name: "AccessQ Pro", href: "/dashboard/upgrade", iconComponent: Crown },
            { name: "Paramètres", href: "/dashboard/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
            {
                name: "Nous contacter",
                href: "mailto:access.qsi@gmail.com?subject=Contact%20AccessQ",
                iconComponent: Mail
            },
        ];
        if (userProfile?.role === "OPERATOR") {
            return items.filter(item => (
                item.href === "/scan"
                || item.href === "/dashboard/settings"
                || item.name === "Nous contacter"
            ));
        }
        if (userProfile?.role === "ORG_AGENT") {
            return items.filter(item => item.name !== "Agents" && item.href !== "/dashboard/upgrade");
        }
        return items;
    }, [userProfile]);

    const pageTitle = useMemo(() => {
        return navigation.find(n => pathname === n.href || (pathname.startsWith(n.href) && n.href !== '/dashboard'))?.name || "Dashboard";
    }, [navigation, pathname]);

    const planLabel = planName || userProfile?.subscription?.planName || userProfile?.planName || "Découverte";
    const homeHref = isOperator ? "/scan" : "/dashboard";

    if (profileLoading || (isOperator && !operatorAllowedPath) || (isAgent && agentRestrictedPath)) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" aria-label="Chargement" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white overflow-hidden">
            {/* **************************************** */}
            {/* Navigation latérale sur ordinateur */}
            {/* **************************************** */}
            <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-sm z-20">
                {/* **************************************** */}
                {/* Logo de l'application */}
                {/* **************************************** */}
                <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
                    <Link href={homeHref} className="flex items-center gap-3">
                        <img
                            src="/logo/access_logo.png"
                            alt="Logo AccessQ"
                            className="w-8 h-8 drop-shadow-sm"
                        />
                        <span className="font-bold tracking-tight text-lg bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">
                            AccessQ
                        </span>
                    </Link>
                </div>

                {/* **************************************** */}
                {/* Liens de navigation */}
                {/* **************************************** */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
                        const ItemIcon = item.iconComponent;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-colors ${isActive
                                    ? "bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm"
                                    : item.special
                                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                            >
                                {ItemIcon ? (
                                    <ItemIcon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={2} />
                                ) : (
                                    <svg className={`w-5 h-5 ${isActive ? 'text-blue-600' : (item.special ? 'text-white' : 'text-slate-400 dark:text-slate-500')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                    </svg>
                                )}
                                <span>{item.name}</span>
                                {item.special && !isActive && (
                                    <span className="ml-auto flex h-2 w-2 rounded-full bg-white dark:bg-slate-950 animate-pulse"></span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* **************************************** */}
                {/* Profil utilisateur et déconnexion */}
                {/* **************************************** */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-100">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm uppercase">
                            {userProfile ? (userProfile.name || userProfile.full_name || "U").charAt(0) : "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{userProfile ? (userProfile.name || userProfile.full_name) : "Chargement..."}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userProfile ? (userProfile.role === 'ORG_ADMIN' ? 'Admin' : (userProfile.role === 'OPERATOR' ? 'Opérateur' : 'Agent')) : "..."}</p>
                            {!isOperator && <div className="mt-1 flex items-center gap-2">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${isProPlan ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                    {planLabel}
                                </span>
                                {!isProPlan && !isAgent && (
                                    <Link href="/dashboard/upgrade" className="text-[10px] font-semibold text-amber-600 hover:text-amber-700">
                                        Upgrade
                                    </Link>
                                )}
                            </div>}
                        </div>
                        <button 
                            onClick={() => setShowLogoutModal(true)}
                            title="Déconnexion"
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* **************************************** */}
            {/* Zone principale */}
            {/* **************************************** */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* **************************************** */}
                {/* En-tête de navigation sur mobile */}
                {/* **************************************** */}
                <header className="lg:hidden h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20 shadow-sm">
                    <Link href={homeHref} className="flex items-center gap-2">
                        <img
                            src="/logo/access_logo.png"
                            alt="Logo AccessQ"
                            className="w-6 h-6"
                        />
                        <span className="font-bold tracking-tight bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">
                            AccessQ
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setIsMobileNavOpen(true)}
                        aria-label="Ouvrir le menu"
                        aria-expanded={isMobileNavOpen}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-xl"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                {/* **************************************** */}
                {/* Barre supérieure sur ordinateur */}
                {/* **************************************** */}
                <header className="hidden lg:flex h-20 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 items-center justify-between px-8 z-10 sticky top-0">
                    <div className="flex items-center">
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                            {pageTitle}
                        </h1>
                    </div>

                </header>

                {/* **************************************** */}
                {/* Contenu de la page active */}
                {/* **************************************** */}
                <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>

            {/* **************************************** */}
            {/* Menu latéral mobile */}
            {/* **************************************** */}
            {isMobileNavOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label="Fermer le menu"
                        onClick={() => setIsMobileNavOpen(false)}
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
                    />
                    <aside className="relative flex h-full w-[min(19rem,86vw)] flex-col bg-white shadow-2xl dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
                        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800">
                            <Link href={homeHref} className="flex items-center gap-2">
                                <img
                                    src="/logo/access_logo.png"
                                    alt="Logo AccessQ"
                                    className="w-7 h-7"
                                />
                                <span className="font-bold tracking-tight bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">
                                    AccessQ
                                </span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => setIsMobileNavOpen(false)}
                                aria-label="Fermer le menu"
                                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <nav className="flex-1 overflow-y-auto py-5 px-4 space-y-1.5">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
                                const ItemIcon = item.iconComponent;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3.5 py-3 rounded-lg font-medium text-sm transition-colors ${isActive
                                            ? "bg-blue-50 text-blue-700 border border-blue-100/50 shadow-sm"
                                            : item.special
                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                                            }`}
                                    >
                                        {ItemIcon ? (
                                            <ItemIcon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={2} />
                                        ) : (
                                            <svg className={`w-5 h-5 ${isActive ? 'text-blue-600' : (item.special ? 'text-white' : 'text-slate-400 dark:text-slate-500')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                            </svg>
                                        )}
                                        <span>{item.name}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 rounded-lg border border-slate-100 px-2 py-2 dark:border-slate-800">
                                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm uppercase">
                                    {userProfile ? (userProfile.name || userProfile.full_name || "U").charAt(0) : "U"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{userProfile ? (userProfile.name || userProfile.full_name) : "Chargement..."}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userProfile ? (userProfile.role === 'ORG_ADMIN' ? 'Admin' : (userProfile.role === 'OPERATOR' ? 'Opérateur' : 'Agent')) : "..."}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileNavOpen(false);
                                    setShowLogoutModal(true);
                                }}
                                className="mt-3 w-full rounded-xl border border-red-100 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                                Déconnexion
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* **************************************** */}
            {/* Confirmation de déconnexion */}
            {/* **************************************** */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 flex items-center justify-center mb-4">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">Êtes-vous sûr de vouloir vous déconnecter de votre compte AccessQ ?</p>
                            
                            <div className="flex gap-3 w-full">
                                <button 
                                    onClick={() => setShowLogoutModal(false)}
                                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors"
                                >
                                    Annuler
                                </button>
                                <button 
                                    onClick={handleLogout}
                                    className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95"
                                >
                                    Déconnexion
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
