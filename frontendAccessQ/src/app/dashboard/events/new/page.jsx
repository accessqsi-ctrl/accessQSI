"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import LoadingBar from "../../../components/LoadingBar";
import PlanQuotaStatus from "../../../components/PlanQuotaStatus";
import { useUserPlan } from "../../../lib/useUserPlan";

export default function NewEventPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        areaIds: [],
        startDate: "",
        endDate: "",
        eventPassId: ""
    });
    const [areas, setAreas] = useState([]);
    const [eventPasses, setEventPasses] = useState([]);
    const [loadingAreas, setLoadingAreas] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { planUsage, profileLoading } = useUserPlan();
    const eventQuota = planUsage.events;
    const eventQuotaReached = Boolean(eventQuota?.reached);

    useEffect(() => {
        const fetchAreas = async () => {
            try {
                const res = await apiFetch("/areas", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });
                const data = await res.json();
                if (data.success) {
                    setAreas(data.areas || []);
                }
            } catch (err) {
                console.error("Error fetching areas:", err);
            } finally {
                setLoadingAreas(false);
            }
        };
        fetchAreas();
        apiFetch("/billing")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setEventPasses((data.eventPasses || []).filter((pass) => pass.status === "AVAILABLE"));
            })
            .catch(() => setEventPasses([]));
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAreaChange = (areaId) => {
        setFormData(prev => {
            const currentIds = prev.areaIds;
            if (currentIds.includes(areaId)) {
                return { ...prev, areaIds: currentIds.filter(id => id !== areaId) };
            } else {
                return { ...prev, areaIds: [...currentIds, areaId] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (eventQuotaReached && !formData.eventPassId) {
            setError("Votre quota mensuel d'événements est atteint. Sélectionnez un Pass événement, attendez le prochain cycle ou changez de plan.");
            return;
        }

        if (!formData.title || !formData.startDate || !formData.endDate) {
            setError("Titre, Date de début et Date de fin sont obligatoires.");
            return;
        }

        if (new Date(formData.endDate) <= new Date(formData.startDate)) {
            setError("La date de fin doit être postérieure à la date de début.");
            return;
        }

        if (formData.areaIds.length === 0) {
            setError("Veuillez sélectionner au moins une zone.");
            return;
        }

        setLoading(true);

        try {
            const res = await apiFetch("/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (data.success) {
                router.push("/dashboard/events");
            } else {
                setError(data.message || "Erreur lors de la création de l'événement.");
            }
        } catch (err) {
            console.error("Error creating event:", err);
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* **************************************** */}
            {/* Retour et en-tête de la page */}
            {/* **************************************** */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/events" className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Créer un événement</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Associez une période de validité aux zones de contrôle.</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200">
                    {error}
                </div>
            )}

            <PlanQuotaStatus label="Événements créés pendant ce cycle mensuel" quota={eventQuota} />

            {eventPasses.length > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <label className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                        Utiliser un Pass événement (facultatif)
                        <select
                            name="eventPassId"
                            value={formData.eventPassId}
                            onChange={handleChange}
                            className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-slate-900 dark:border-emerald-900 dark:bg-slate-950 dark:text-white"
                        >
                            <option value="">Utiliser le quota de mon abonnement</option>
                            {eventPasses.map((pass) => (
                                <option key={pass.id} value={pass.id}>Pass #{pass.id} · 200 QR · 30 jours</option>
                            ))}
                        </select>
                    </label>
                    <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                        Le Pass sera attribué à cet événement et ses 30 jours commenceront à la création.
                    </p>
                </div>
            )}

            {/* **************************************** */}
            {/* Formulaire de création de l'événement */}
            {/* **************************************** */}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                <fieldset disabled={profileLoading || (eventQuotaReached && !formData.eventPassId)} className="contents">
                {loading && (
                    <LoadingBar label="Création de l'événement" />
                )}

                {/* **************************************** */}
                {/* Informations générales */}
                {/* **************************************** */}
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">Informations</h2>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nom de l'événement *</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            placeholder="Ex. Conférence annuelle, Hall principal"
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Détails utiles pour les agents ou l'administration..."
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
                        ></textarea>
                    </div>
                </div>

                {/* **************************************** */}
                {/* Période et zones */}
                {/* **************************************** */}
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">Période et zones</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Début *</label>
                            <input
                                type="datetime-local"
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-slate-600 dark:text-slate-300"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Fin *</label>
                            <input
                                type="datetime-local"
                                name="endDate"
                                value={formData.endDate}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-slate-600 dark:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Zones *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {loadingAreas ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 italic">Chargement des zones...</p>
                            ) : areas.length === 0 ? (
                                <p className="text-sm text-red-500">Aucune zone disponible - Veuillez en créer une</p>
                            ) : (
                                areas.map(area => (
                                    <label key={area.area_id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${formData.areaIds.includes(area.area_id) ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-600 dark:text-slate-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={formData.areaIds.includes(area.area_id)}
                                            onChange={() => handleAreaChange(area.area_id)}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{area.area_name}</p>
                                            <p className="text-xs opacity-70">Accréditation {area.accreditation_level}</p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                </div>


                {/* **************************************** */}
                {/* Actions du formulaire */}
                {/* **************************************** */}
                <div className="pt-4 flex items-center justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
                    <Link href="/dashboard/events" className="px-6 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm transition-all text-sm">
                        Annuler
                    </Link>
                    <button
                        type="submit"
                        disabled={loading || profileLoading || (eventQuotaReached && !formData.eventPassId)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        )}
                        {loading ? "Enregistrement..." : "Enregistrer"}
                    </button>
                </div>
                </fieldset>
            </form>
        </div>
    );
}
