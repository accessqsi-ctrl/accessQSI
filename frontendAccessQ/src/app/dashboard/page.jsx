"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Download, TrendingUp, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeQrs: 0,
        totalScans: 0,
        upcomingEvents: 0,
        nextEventTitle: "Aucun événement",
        activeAgents: 0,
        scansByDay: [],
        topAgents: [],
        recentScans: []
    });
    const [userName, setUserName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [toast, setToast] = useState({ show: false, message: "" });


    const handleExport = async (format) => {
        if (stats.totalScans === 0) {
            setToast({ show: true, message: "Aucune donnée de scan n'est disponible pour l'exportation." });
            setTimeout(() => setToast({ show: false, message: "" }), 4000);
            return;
        }
        window.open(`${process.env.NEXT_PUBLIC_API_URL}/export/${format}`, '_blank');
    };


    
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch User Profile to get Name
                const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/profile`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include"
                });
                const profileData = await profileRes.json();

                if (profileData.success && profileData.user) {
                    const fullName = profileData.user.name || profileData.user.full_name || "Admin";
                    setUserName(fullName.split(' ')[0]); // Get first name
                }

                // Fetch Dashboard Stats
                const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include"
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
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden bg-white dark:bg-slate-950 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-full blur-[60px] pointer-events-none -mr-10 -mt-10" />
                <div className="absolute bottom-0 right-32 w-48 h-48 bg-blue-100/40 rounded-t-full blur-[50px] pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 mt-2">Welcome back, {userName || "Admin"} 👋</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg">Here's what's happening in your organization today.</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => handleExport('csv')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors border border-slate-200 dark:border-slate-800"
                        >
                            <Download className="w-4 h-4" />
                            CSV
                        </button>
                        <button 
                            onClick={() => handleExport('pdf')}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-semibold rounded-xl shadow-sm transition-colors border border-slate-200 dark:border-slate-800"
                        >
                            <Download className="w-4 h-4" />
                            PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Stat 1 */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active QR Codes</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeQrs}</h4>
                        </div>
                    </div>
                    <div className="flex items-center text-sm">
                        <span className="text-emerald-500 font-medium flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                            12%
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 ml-2">from last month</span>
                    </div>
                </div>

                {/* Stat 2 */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Scans</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalScans}</h4>
                        </div>
                    </div>
                    <div className="flex items-center text-sm">
                        <span className="text-emerald-500 font-medium flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                            24%
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 ml-2">from last month</span>
                    </div>
                </div>

                {/* Stat 3 */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Upcoming Events</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.upcomingEvents}</h4>
                        </div>
                    </div>
                    <div className="flex items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium truncate">Next: {stats.nextEventTitle}</span>
                    </div>
                </div>

                {/* Stat 4 */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Agents</p>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeAgents}</h4>
                        </div>
                    </div>
                    <div className="flex items-center text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Out of 15 allowed</span>
                    </div>
                </div>
            </div>

            {/* Charts & Top Performance Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Line Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activity Overview</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total scans over the last 7 days</p>
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

                {/* Top Agents Panel */}
                <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Top Agents</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Best performance by scans</p>
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

            {/* Recent Activity Table */}
            <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Scans</h3>
                    <button className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">View all</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100/80 text-slate-600 dark:text-slate-300 text-sm border-b-2 border-slate-300 dark:border-slate-700">
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Access Code</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Event / Location</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Agent</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Time</th>
                                <th className="px-8 py-4 font-semibold uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-300 text-slate-700 dark:text-slate-200 text-sm">
                            {stats.recentScans && stats.recentScans.length > 0 ? (
                                stats.recentScans.map((scan) => (
                                    <tr key={scan.id} className="hover:bg-slate-50/50 transition-colors">
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
                                                {scan.status === 'authorized' ? 'Granted' : 'Denied'}
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

            {/* ── CUSTOM TOAST ── */}
            {toast.show && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="bg-slate-900 dark:bg-slate-100 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50 backdrop-blur-md">
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


