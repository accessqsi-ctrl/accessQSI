import { Loader2, Download, X, CheckCircle2, FileSpreadsheet } from "lucide-react";
import LoadingBar from "../../../../components/LoadingBar";

export default function ImportQrModal({ handleDownloadTemplate, handleImportCSV, importError, importFile, importReport, importSuccess, importing, setImportFile, setShowImportModal }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
                <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Importer des QR Codes</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Téléchargez un fichier CSV pour générer des codes QR en masse.</p>

                <form onSubmit={handleImportCSV} className="space-y-4">
                    {importing && (
                        <LoadingBar label="Import CSV et génération des QR" />
                    )}
                    {importError && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{importError}</div>
                    )}
                    {importSuccess && (
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm border border-emerald-100 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> {importSuccess}
                        </div>
                    )}
                    {importReport?.errors?.length > 0 && (
                        <div className="max-h-44 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                            <p className="mb-2 font-bold">
                                Détail des lignes non terminées ({importReport.errors.length})
                            </p>
                            <ul className="space-y-1">
                                {importReport.errors.map((error, index) => (
                                    <li key={`${error.line}-${error.stage}-${index}`}>
                                        Ligne {error.line} · {error.field || error.stage} : {error.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer relative">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setImportFile(e.target.files[0])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-2">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto">
                                <Download className="w-6 h-6 rotate-180" />
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{importFile ? importFile.name : "Cliquez ou glissez votre fichier CSV ici"}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">Format .csv uniquement</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Instructions</p>
                        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
                            <li>Utilisez le modèle CSV fourni ci-dessous.</li>
                            <li>Les colonnes obligatoires sont : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">fullName</code>.</li>
                            <li>Les types d'accès valides : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">single</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">multi</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">unlimited</code>.</li>
                            <li>Limite par période (optionnelle) : <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">periodUnit</code> = <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">day</code>, <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">week</code> ou <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">month</code>, avec <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">periodLimit</code> (1 par défaut).</li>
                        </ul>
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            className="mt-3 inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-xs"
                        >
                            <FileSpreadsheet className="w-3 h-3" /> Télécharger le modèle CSV
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={importing || !importFile}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>}
                        {importing ? "Importation..." : "Importer maintenant"}
                    </button>
                </form>
            </div>
        </div>
    );
}
