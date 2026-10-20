import { X } from "lucide-react";
import { apiUrl } from "../../../../lib/api";

export default function QrPreviewModal({ event, selectedQr, setSelectedQr }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-3xl shadow-2xl p-6 relative overflow-hidden text-center animate-in zoom-in duration-300">
                <button onClick={() => setSelectedQr(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-6">Détails du Ticket</h3>

                <div className="w-full flex flex-col items-center">
                    <img src={apiUrl(selectedQr.qrUrl || `/qr/image/${selectedQr.id}`)} alt="QR Code" className="w-48 h-48 rounded-2xl border border-slate-100 dark:border-slate-800 p-2 shadow-inner bg-slate-50 dark:bg-slate-900 mb-6 object-contain" />

                    <div className="w-full space-y-4 text-left bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div>
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Titulaire</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{selectedQr.holder}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Événement</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{event.title}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Niveau d’accréditation</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Niveau {selectedQr.level ?? 1}</p>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Statut</p>
                                <p className={`text-xs font-bold capitalize ${selectedQr.status === 'active' ? 'text-emerald-600' : selectedQr.status === 'revoked' ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {selectedQr.status}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Scans</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{selectedQr.scans}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
