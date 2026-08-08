"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { useUserPlan } from "../../lib/useUserPlan";
import PlanQuotaStatus from "../../components/PlanQuotaStatus";

export default function EventsPage() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const { userProfile, planUsage, profileLoading } = useUserPlan();
    const eventQuota = planUsage.events;
    const eventQuotaReached = Boolean(eventQuota?.reached);
    const userRole = userProfile?.role;

    // Filters state
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tous les statuts");
    const statusLabel = {
        Upcoming: "À venir",
        Active: "Actif",
        Past: "Terminé"
    };

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const res = await apiFetch("/events", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });
                const data = await res.json();

                if (data.success) {
                    setEvents(data.events || []);
                } else {
                    setError("Impossible de charger les événements.");
                }
            } catch (err) {
                console.error("Error fetching events:", err);
                setError("Erreur de connexion au serveur.");
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const filteredEvents = events.filter(event => {
        const matchesSearch = !searchQuery || 
            event.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            event.location?.toLowerCase().includes(searchQuery.toLowerCase());
            
        const matchesStatus = statusFilter === "Tous les statuts" ||
                              event.status === statusFilter;
                              
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* **************************************** */}
            {/* En-tête et action de création */}
            {/* **************************************** */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Événements et zones d'accès</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Définissez les périodes et lieux où les QR peuvent être validés.</p>
                </div>
                {(userRole === "SUPER_ADMIN" || userRole === "ORG_ADMIN") && (
                    eventQuotaReached ? (
                    <button
                        type="button"
                        disabled
                        title="Quota d'événements atteint"
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        Créer un événement
                    </button>
                    ) : (
                        <Link
                            href="/dashboard/events/new"
                            aria-disabled={profileLoading}
                            className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 ${profileLoading ? "pointer-events-none opacity-50" : ""}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Créer un événement
                        </Link>
                    )
                )}
            </div>

            <PlanQuotaStatus label="Événements créés pendant ce cycle mensuel" quota={eventQuota} />

            {/* **************************************** */}
            {/* Recherche et filtre par statut */}
            {/* **************************************** */}
            <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher par nom ou zone..."
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-colors shadow-sm"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option value="Tous les statuts">Tous les statuts</option>
                        <option value="Upcoming">À venir</option>
                        <option value="Active">Actif</option>
                        <option value="Past">Terminé</option>
                    </select>
                </div>
            </div>

            {/* **************************************** */}
            {/* Tableau des événements */}
            {/* **************************************** */}
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Événement</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Période</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Zone</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">QR actifs</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                                        <p className="mt-2 text-slate-500 dark:text-slate-400">Chargement des événements...</p>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-red-500 font-medium">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredEvents.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Aucun événement</h3>
                                        <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{events.length === 0 ? "Aucun événement n'est encore configuré." : "Aucun événement ne correspond aux filtres."}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEvents.map((event) => (
                                    <tr key={event.id} className="table-row-hover group">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            <Link href={`/dashboard/events/${event.id}`} className="flex items-center gap-3 hover:text-[#4f6376] dark:hover:text-[#d7e0e8] transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                </div>
                                                {event.name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{event.date}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{event.location}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{event.qrs}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${event.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                                                event.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                }`}>
                                                {statusLabel[event.status] || event.status}
                                            </span>
                                        </td>

                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
