import { Loader2, X, CheckCircle2 } from "lucide-react";
import CardTemplatePreview from "../../../../components/CardTemplatePreview";

export default function CardTemplateModal({ cardGeneratingId, cardTemplateError, cardTemplates, handleGenerateCardForQr, qrForCardTemplate, replacementCardTemplate, replacementCardTemplateId, setCardTemplateError, setQrForCardTemplate, setReplacementCardTemplateId }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <form onSubmit={handleGenerateCardForQr} className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {qrForCardTemplate.cardTemplateId ? "Changer le modèle de carte" : "Générer une carte"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            QR de {qrForCardTemplate.holder}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setQrForCardTemplate(null)}
                        disabled={cardGeneratingId === qrForCardTemplate.id}
                        className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-900"
                        aria-label="Fermer"
                    >
                        <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </button>
                </div>

                <div className="grid gap-6 p-6 md:grid-cols-2">
                    <div className="space-y-4">
                        {cardTemplateError && (
                            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                                {cardTemplateError}
                            </div>
                        )}
                        <div className="space-y-2">
                            <label htmlFor="replacement-card-template" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Nouveau modèle
                            </label>
                            <select
                                id="replacement-card-template"
                                required
                                value={replacementCardTemplateId}
                                onChange={(event) => {
                                    setReplacementCardTemplateId(event.target.value);
                                    setCardTemplateError("");
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">Sélectionner un modèle</option>
                                {cardTemplates.map(template => (
                                    <option key={template.templateId} value={template.templateId}>
                                        {template.name}{template.isDefault ? " — par défaut" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                            Le nouvel instantané sera utilisé pour les prochains téléchargements. Les cartes déjà imprimées ne sont pas modifiées.
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-900">
                        <p className="mb-4 text-center text-xs font-black uppercase tracking-widest text-slate-400">Aperçu du modèle</p>
                        <CardTemplatePreview template={replacementCardTemplate} />
                        <p className="mt-3 text-center text-sm font-bold text-slate-700 dark:text-slate-200">
                            {replacementCardTemplate?.name || "Sélectionnez un modèle"}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setQrForCardTemplate(null)}
                        disabled={cardGeneratingId === qrForCardTemplate.id}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={!replacementCardTemplateId || cardGeneratingId === qrForCardTemplate.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {cardGeneratingId === qrForCardTemplate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {cardGeneratingId === qrForCardTemplate.id ? "Mise à jour..." : "Confirmer le modèle"}
                    </button>
                </div>
            </form>
        </div>
    );
}
