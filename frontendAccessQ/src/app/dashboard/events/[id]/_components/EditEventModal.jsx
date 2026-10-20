import { Loader2, Edit2, X } from "lucide-react";
import LoadingBar from "../../../../components/LoadingBar";

export default function EditEventModal({ areas, editError, editForm, handleAreaChange, handleUpdateEvent, loadingAreas, setEditForm, setShowEditModal, updatingEvent }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Modifier l'événement</h2>
                    <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                </div>
                <form onSubmit={handleUpdateEvent} className="p-6 space-y-4">
                    {updatingEvent && (
                        <LoadingBar label="Mise à jour de l'événement" />
                    )}
                    {editError && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{editError}</div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Titre *</label>
                        <input
                            required
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Zones / Areas *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                            {loadingAreas ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">Chargement...</p>
                            ) : areas.length === 0 ? (
                                <p className="text-xs text-red-500">Aucune zone disponible</p>
                            ) : (
                                areas.map(area => (
                                    <label key={area.area_id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${editForm.areaIds.includes(area.area_id) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={editForm.areaIds.includes(area.area_id)}
                                            onChange={() => handleAreaChange(area.area_id)}
                                            className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-slate-700"
                                        />
                                        <span className="text-xs font-medium truncate">{area.area_name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date de début</label>
                            <input
                                type="datetime-local"
                                value={editForm.startDate}
                                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-600 dark:text-slate-300"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date de fin</label>
                            <input
                                type="datetime-local"
                                value={editForm.endDate}
                                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-600 dark:text-slate-300"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</label>
                        <textarea
                            rows="3"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all resize-none"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={updatingEvent}
                        className="w-full py-3 bg-slate-900 text-white hover:bg-black dark:bg-[#BED3C3] dark:text-slate-900 dark:hover:bg-[#AEC5B3] font-semibold rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {updatingEvent ? <Loader2 className="w-5 h-5 animate-spin" /> : <Edit2 className="w-5 h-5" />}
                        {updatingEvent ? "Mise à jour..." : "Enregistrer les modifications"}
                    </button>
                </form>
            </div>
        </div>
    );
}
