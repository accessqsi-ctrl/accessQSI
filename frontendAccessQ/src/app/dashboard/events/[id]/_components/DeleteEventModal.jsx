import { Loader2, Trash2 } from "lucide-react";
import LoadingBar from "../../../../components/LoadingBar";

export default function DeleteEventModal({ canDeleteEvent, deleteConfirmationText, expectedDeleteConfirmation, handleDeleteEvent, isDeleting, setDeleteConfirmationText, setShowDeleteConfirm }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                {isDeleting && (
                    <LoadingBar label="Suppression en cours" className="mb-5 text-left" />
                )}
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Supprimer l'événement ?</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 mb-6">
                    Cette action supprimera définitivement <span className="font-semibold text-slate-700 dark:text-slate-200">"{event.title}"</span> et tous ses codes QR associés.
                </p>
                <div className="text-left mb-6 space-y-2">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Phrase de confirmation
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Écrivez exactement <span className="font-semibold text-slate-700 dark:text-slate-200">"{expectedDeleteConfirmation}"</span>
                    </p>
                    <input
                        type="text"
                        value={deleteConfirmationText}
                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        autoComplete="off"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmationText("");
                        }}
                        className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleDeleteEvent}
                        disabled={isDeleting || !canDeleteEvent}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {isDeleting ? "Suppression..." : "Confirmer"}
                    </button>
                </div>
            </div>
        </div>
    );
}
