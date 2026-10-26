import { Loader2 } from "lucide-react";
import LoadingBar from "../../../../components/LoadingBar";

export default function RevokeQrModal({ handleRevoke, qrToRevoke, revokingId, setQrToRevoke }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-300">
                {revokingId === qrToRevoke.id && (
                    <LoadingBar label="Révocation en cours" className="mb-5" />
                )}
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 dark:bg-red-500/15 dark:text-red-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Révoquer ce QR code ?</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Le QR code de <span className="font-semibold text-slate-700 dark:text-slate-200">{qrToRevoke.holder}</span> ne pourra plus être utilisé pour accéder à <span className="font-semibold text-slate-700 dark:text-slate-200">"{event.title}"</span>.
                </p>
                <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">QR ID</p>
                    <p className="font-semibold text-slate-900 dark:text-white">#{qrToRevoke.id}</p>
                </div>
                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={() => setQrToRevoke(null)}
                        disabled={revokingId === qrToRevoke.id}
                        className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={() => handleRevoke(qrToRevoke.id)}
                        disabled={revokingId === qrToRevoke.id}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {revokingId === qrToRevoke.id && <Loader2 className="w-4 h-4 animate-spin" />}
                        Révoquer
                    </button>
                </div>
            </div>
        </div>
    );
}
