"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useState, useEffect, useMemo } from "react";

export default function DashboardLayout({ children }) {
    const pathname = usePathname();
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/profile`, { credentials: "include" });
                const data = await res.json();
                if (data.success) setUserProfile(data.user);
            } catch (err) {
                console.error("Error fetching layout profile:", err);
            }
        };
        fetchProfile();
    }, []);

    const navigation = useMemo(() => {
        const items = [
            { name: "Overview", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
            { name: "Events", href: "/dashboard/events", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
            { name: "Agents", href: "/dashboard/agents", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
            { name: "Areas", href: "/dashboard/areas", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
            { name: "Scanner Mobile", href: "/scan", icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z", special: true },
            { name: "Settings", href: "/dashboard/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        ];
        if (userProfile && userProfile.role !== "SUPER_ADMIN" && userProfile.role !== "ORG_ADMIN") {
            return items.filter(n => n.name !== "Agents");
        }
        return items;
    }, [userProfile]);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-white overflow-hidden">
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-sm z-20">
                {/* Logo Area */}
                <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <img
                            src="/logo/access_logo.png"
                            alt="QR Access Logo"
                            className="w-8 h-8 drop-shadow-sm"
                        />
                        <span className="font-bold tracking-tight text-lg text-blue-700">
                            QR Access
                        </span>
                    </Link>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
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
                                <svg className={`w-5 h-5 ${isActive ? 'text-blue-600' : (item.special ? 'text-white' : 'text-slate-400 dark:text-slate-500')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                </svg>
                                <span>{item.name}</span>
                                {item.special && !isActive && (
                                    <span className="ml-auto flex h-2 w-2 rounded-full bg-white dark:bg-slate-950 animate-pulse"></span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User / Profile Area bottom */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-100">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm uppercase">
                            {userProfile ? (userProfile.name || userProfile.full_name || "U").charAt(0) : "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{userProfile ? (userProfile.name || userProfile.full_name) : "Chargement..."}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userProfile ? (userProfile.role === 'ORG_ADMIN' ? 'Admin' : (userProfile.role === 'OPERATOR' ? 'Opérateur' : 'Agent')) : "..."}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20 shadow-sm">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <img
                            src="/logo/access_logo.png"
                            alt="QR Access Logo"
                            className="w-6 h-6"
                        />
                        <span className="font-bold tracking-tight text-blue-700">
                            QR Access
                        </span>
                    </Link>
                    <button className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                </header>

                {/* Header Top Nav (Desktop) */}
                <header className="hidden lg:flex h-20 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 items-center justify-between px-8 z-10 sticky top-0">
                    <div className="flex items-center">
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                            {navigation.find(n => pathname === n.href || (pathname.startsWith(n.href) && n.href !== '/dashboard'))?.name || "Dashboard"}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="relative w-10 h-10 rounded-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 hover:bg-blue-50 flex items-center justify-center transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </header>

                {/* Scrollable Page Content */}
                <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
