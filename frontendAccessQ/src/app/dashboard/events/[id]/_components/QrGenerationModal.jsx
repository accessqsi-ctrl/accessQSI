import { Loader2, QrCode, Download, X, CheckCircle2, FileSpreadsheet, FileText, Mail, Phone, Camera, Trash2 } from "lucide-react";
import LoadingBar from "../../../../components/LoadingBar";
import { apiUrl } from "../../../../lib/api";
import { PERIOD_UNIT_OPTIONS, formatInternationalPhone } from "../../../../lib/eventQr.mjs";
import { getCardDownloadUrl } from "./cardDownload";

export default function QrGenerationModal({ cardTemplates, event, generatedAsset, generatingQr, handleGenerateQr, handleQrPhotoChange, qrContactErrors, qrContactTouched, qrError, qrForm, qrPhoto, qrQuotaReached, selectedCardTemplateId, setQrContactTouched, setQrError, setQrForm, setQrSubmitAttempted, setSelectedCardTemplateId, setShowQrModal, showEmailError, showPhoneError }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-slate-950 w-full max-w-3xl rounded-3xl shadow-2xl relative my-8 overflow-hidden text-slate-900 dark:text-slate-100">
                <button
                    onClick={() => {
                        setShowQrModal(false);
                        setQrError("");
                        setQrSubmitAttempted(false);
                    }}
                    className="absolute top-5 right-5 z-10 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-5 sm:px-8">
                    <div className="flex items-start gap-4 pr-10">
                        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                            <QrCode className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Générer un QR Code</h2>
                            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                                Événement : <span className="font-semibold text-slate-900 dark:text-white">{event.title}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleGenerateQr}>
                    <div className="max-h-[72vh] overflow-y-auto px-6 py-6 sm:px-8">
                        {generatingQr && (
                            <LoadingBar label="Génération du QR" className="mb-5" />
                        )}
                        {qrError && (
                            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 animate-in fade-in zoom-in duration-300 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{qrError}</div>
                        )}

                        {generatedAsset && (
                            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Support généré</h3>
                                        <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                                            {generatedAsset.holder} - {generatedAsset.templateName}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <a
                                                href={`${apiUrl(generatedAsset.qrUrl)}?download=1`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 dark:bg-slate-950 dark:text-slate-100 dark:ring-emerald-900/60 dark:hover:bg-emerald-950/40"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                Télécharger QR
                                            </a>
                                            {(generatedAsset.cardPdfUrl || generatedAsset.cardUrl) && (
                                                <a
                                                    href={getCardDownloadUrl(generatedAsset.cardPdfUrl || generatedAsset.cardUrl)}
                                                    download
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-800"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    Télécharger PDF
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-5">
                            {/* Identité et coordonnées du détenteur */}
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="mb-4 flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Titulaire</h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-300">Identité et contact du détenteur </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nom complet *</label>
                                        <input
                                            required
                                            type="text"
                                            name="fullName"
                                            autoComplete="name"
                                            maxLength={120}
                                            placeholder="Ex. Jane Smith"
                                            value={qrForm.fullName}
                                            onChange={(e) => setQrForm({ ...qrForm, fullName: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Email</label>
                                    <div className="relative">
                                                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${showEmailError ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`} />
                                        <input
                                            type="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            placeholder="nom@domaine.com"
                                            value={qrForm.email}
                                            aria-invalid={showEmailError}
                                            onBlur={() => setQrContactTouched({ ...qrContactTouched, email: true })}
                                            onChange={(e) => {
                                                setQrError("");
                                                setQrForm({ ...qrForm, email: e.target.value });
                                            }}
                                                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-950 transition-all ${showEmailError ? "border-red-300 focus:ring-red-500/20" : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20"}`}
                                        />
                                    </div>
                                            <p className={`text-xs leading-relaxed ${showEmailError ? "text-red-600 dark:text-red-300" : "text-slate-600 dark:text-slate-300"}`}>
                                        {showEmailError ? qrContactErrors.email : "Optionnel."}
                                    </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Numéro de téléphone</label>
                                    <div className="relative">
                                                <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${showPhoneError ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`} />
                                        <input
                                            type="tel"
                                            inputMode="tel"
                                            autoComplete="tel"
                                            placeholder="+243 812 345 678"
                                            value={qrForm.phone}
                                            aria-invalid={showPhoneError}
                                            onBlur={() => setQrContactTouched({ ...qrContactTouched, phone: true })}
                                            onChange={(e) => {
                                                setQrError("");
                                                setQrForm({ ...qrForm, phone: formatInternationalPhone(e.target.value) });
                                            }}
                                                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-950 transition-all ${showPhoneError ? "border-red-300 focus:ring-red-500/20" : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20"}`}
                                        />
                                    </div>
                                            <p className={`text-xs leading-relaxed ${showPhoneError ? "text-red-600 dark:text-red-300" : "text-slate-600 dark:text-slate-300"}`}>
                                        {showPhoneError ? qrContactErrors.phone : "Optionnel."}
                                    </p>
                                        </div>
                                    </div>

                                    {/* Photo affichée à l'agent lors du scan */}
                                    <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
                                        <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
                                            {qrPhoto?.previewUrl ? (
                                                <img src={qrPhoto.previewUrl} alt="Aperçu de la photo du titulaire" className="h-full w-full object-cover" />
                                            ) : (
                                                <Camera className="h-7 w-7 text-slate-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Photo du titulaire</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300">Optionnelle. Affichée à l’agent au scan pour vérifier l’identité (cartes d’élève, de cantine, badges).</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                                                    <Camera className="h-3.5 w-3.5" />
                                                    {qrPhoto ? "Changer" : "Ajouter"}
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            handleQrPhotoChange(e.target.files?.[0] || null);
                                                            e.target.value = "";
                                                        }}
                                                    />
                                                </label>
                                                {qrPhoto && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQrPhotoChange(null)}
                                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" /> Retirer
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Choix et personnalisation du modèle de carte */}
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Accès</h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">Définissez le niveau, le nombre d'utilisations et le support généré.</p>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Niveau</label>
                            <input
                                type="number"
                                min="1"
                                value={qrForm.level}
                                onChange={(e) => setQrForm({ ...qrForm, level: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                            />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Type d'accès</label>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {[
                                    { value: 'single', label: 'Simple', desc: '1 scan' },
                                    { value: 'multi', label: 'Multiple', desc: 'N scans' },
                                    { value: 'unlimited', label: 'Illimité', desc: '∞ scans' }
                                ].map(({ value, label, desc }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setQrForm({ ...qrForm, accessType: value, limit: value === 'single' ? "1" : value === 'unlimited' ? "0" : (qrForm.limit == "1" ? "2" : qrForm.limit) })}
                                                    className={`px-3 py-3 rounded-xl border text-left transition-all ${qrForm.accessType === value ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm dark:bg-blue-950/35 dark:border-blue-800 dark:text-blue-200' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#7A90A4] dark:hover:border-[#7A90A4]'}`}
                                    >
                                        <div className="text-sm font-bold">{label}</div>
                                                    <div className="text-[10px] opacity-80 font-medium">{desc}</div>
                                    </button>
                                ))}
                                        </div>
                            </div>
                        </div>

                                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {qrForm.accessType === 'multi' && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nombre de scans</label>
                                            <input
                                                type="number"
                                                min="2"
                                                value={qrForm.limit}
                                                onChange={(e) => setQrForm({ ...qrForm, limit: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Limite par période</label>
                                        <div className="flex gap-2">
                                            {qrForm.periodUnit && (
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="1000"
                                                    aria-label="Nombre de passages par période"
                                                    value={qrForm.periodLimit}
                                                    onChange={(e) => setQrForm({ ...qrForm, periodLimit: e.target.value })}
                                                    className="w-20 px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                                />
                                            )}
                                            <select
                                                value={qrForm.periodUnit}
                                                onChange={(e) => setQrForm({ ...qrForm, periodUnit: e.target.value, periodLimit: qrForm.periodLimit || "1" })}
                                                className="min-w-0 flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                            >
                                                {PERIOD_UNIT_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                            Ex. cantine : 1 par jour. Le compteur repart à minuit, le lundi ou le 1er du mois.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Modèle de carte</label>
                                        <select
                                            value={selectedCardTemplateId}
                                            onChange={(e) => setSelectedCardTemplateId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                        >
                                            <option value="">QR seul, sans carte</option>
                                            {cardTemplates.map(template => (
                                                <option key={template.templateId} value={template.templateId}>
                                                    {template.name}{template.isDefault ? " — par défaut" : ""}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                            {cardTemplates.length > 0
                                                ? "La carte personnalisée sera générée avec le QR et les informations du titulaire."
                                                : "Aucun modèle personnalisé disponible. Créez-en un dans le module Modèles."}
                                        </p>
                                    </div>

                                </div>

                            

                                <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                    <FileSpreadsheet className="mt-0.5 h-4 w-4 flex-none text-[#7A90A4]" />
                                    <p>Choisissez un modèle de carte. Le modèle défini par défaut est présélectionné automatiquement.</p>
                                </div>
                            </section>

                            {/* Limites d'utilisation et niveau d'accréditation */}
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Validité</h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">Les dates sont préremplies depuis l'événement</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Valide du</label>
                                <input
                                    type="datetime-local"
                                    value={qrForm.validFrom}
                                    onChange={(e) => setQrForm({ ...qrForm, validFrom: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Valide jusqu'au</label>
                                <input
                                    type="datetime-local"
                                    value={qrForm.validUntil}
                                    onChange={(e) => setQrForm({ ...qrForm, validUntil: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-950 transition-all"
                                />
                                    </div>
                                </div>
                            </section>
                            </div>
                        </div>

                    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60 sm:px-8">
                        <button
                            type="submit"
                            disabled={generatingQr || qrQuotaReached}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                        >
                            {generatingQr ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                            {generatingQr ? "Génération en cours..." : "Générer & Sauvegarder"}
                        </button>
                    </div>
                    </form>
            </div>
        </div>
    );
}
