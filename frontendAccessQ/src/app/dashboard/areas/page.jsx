"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Edit2, MapPin } from "lucide-react";
import { apiFetch } from "../../lib/api";

export default function AreasPage() {
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState(null);
    const [areaToDelete, setAreaToDelete] = useState(null);
    const [deletingAreaId, setDeletingAreaId] = useState(null);
    const [formData, setFormData] = useState({ area_name: "", accreditation_level: 1 });

    const fetchAreas = async () => {
        try {
            const res = await apiFetch("/areas", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                setAreas(data.areas || []);
            } else {
                setError("Impossible de charger les zones.");
            }
        } catch (err) {
            console.error("Error fetching areas:", err);
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAreas();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = editingArea
            ? `/areas/${editingArea.area_id}`
            : "/areas";
        const method = editingArea ? "PUT" : "POST";

        try {
            const res = await apiFetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                setEditingArea(null);
                setFormData({ area_name: "", accreditation_level: 1 });
                fetchAreas();
            }
        } catch (err) {
            console.error("Error saving area:", err);
        }
    };

    const handleDelete = async (area) => {
        setDeletingAreaId(area.area_id);
        try {
            const res = await apiFetch(`/areas/${area.area_id}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                setAreaToDelete(null);
                fetchAreas();
            }
        } catch (err) {
            console.error("Error deleting area:", err);
        } finally {
            setDeletingAreaId(null);
        }
    };

    const openEditModal = (area) => {
        setEditingArea(area);
        setFormData({ area_name: area.area_name, accreditation_level: area.accreditation_level });
        setIsModalOpen(true);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Zones d'accès</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gérez les lieux physiques de votre organisation.</p>
                </div>
                <button
                    onClick={() => { setEditingArea(null); setFormData({ area_name: "", accreditation_level: 1 }); setIsModalOpen(true); }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-all text-sm"
                >
                    <Plus className="w-5 h-5" />
                    Ajouter une zone
                </button>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Nom de la zone</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Niveau d'accréditation</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 dark:text-slate-200 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                                        <p className="mt-2 text-slate-500 dark:text-slate-400">Chargement des zones...</p>
                                    </td>
                                </tr>
                            ) : areas.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        Aucune zone trouvée. Commencez par en ajouter une.
                                    </td>
                                </tr>
                            ) : (
                                areas.map((area) => (
                                    <tr key={area.area_id} className="hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <MapPin className="w-5 h-5" />
                                            </div>
                                            {area.area_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-100">
                                                Niveau {area.accreditation_level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openEditModal(area)} className="p-1.5 text-blue-600 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setAreaToDelete(area)} className="p-1.5 text-red-600 dark:text-red-300 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingArea ? "Modifier la zone" : "Nouvelle zone"}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Nom de la zone</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.area_name}
                                    onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: Entrée Principale, Server Room..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Niveau d'accréditation requis</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    max="10"
                                    value={formData.accreditation_level}
                                    onChange={(e) => setFormData({ ...formData, accreditation_level: Number(e.target.value) })}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-sm transition-colors"
                                >
                                    {editingArea ? "Enregistrer" : "Créer"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {areaToDelete && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Supprimer cette zone ?</h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            La zone <span className="font-semibold text-slate-700 dark:text-slate-200">"{areaToDelete.area_name}"</span> ne sera plus disponible pour les événements et les contrôles d'accès.
                        </p>
                        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                            Niveau d'accréditation requis : <span className="font-semibold">Niveau {areaToDelete.accreditation_level}</span>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setAreaToDelete(null)}
                                disabled={deletingAreaId === areaToDelete.area_id}
                                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(areaToDelete)}
                                disabled={deletingAreaId === areaToDelete.area_id}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {deletingAreaId === areaToDelete.area_id && <Loader2 className="w-4 h-4 animate-spin" />}
                                Supprimer la zone
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
