import { Loader2, Plus } from "lucide-react";
import LoadingBar from "../../../../components/LoadingBar";

export default function RechargeQrModal({ handleRecharge, qrToRecharge, rechargeAmount, rechargeError, rechargingId, setQrToRecharge, setRechargeAmount }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <form onSubmit={handleRecharge} className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-300">
                {rechargingId === qrToRecharge.id && (
                    <LoadingBar label="Recharge en cours" className="mb-5" />
                )}
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded-2xl flex items-center justify-center mb-4">
                    <Plus className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recharger ce QR code</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Ajoutez des passages au QR de <span className="font-semibold text-slate-700 dark:text-slate-200">{qrToRecharge.holder}</span>. Les {qrToRecharge.scans_count} passages déjà consommés et leur historique seront conservés.
                </p>

                <label className="block mt-5">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Passages à ajouter</span>
                    <input
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        required
                        autoFocus
                        value={rechargeAmount}
                        onChange={(event) => setRechargeAmount(event.target.value)}
                        disabled={rechargingId === qrToRecharge.id}
                        className="mt-2 w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60"
                    />
                </label>

                <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Utilisations actuelles</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{qrToRecharge.scans}</span>
                </div>

                {rechargeError && (
                    <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{rechargeError}</p>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={() => setQrToRecharge(null)}
                        disabled={rechargingId === qrToRecharge.id}
                        className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={rechargingId === qrToRecharge.id}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {rechargingId === qrToRecharge.id && <Loader2 className="w-4 h-4 animate-spin" />}
                        Recharger
                    </button>
                </div>
            </form>
        </div>
    );
}
