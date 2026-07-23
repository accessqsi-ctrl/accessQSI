"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, ImagePlus, Loader2, RefreshCw, Send } from "lucide-react";
import { apiFetch, apiUrl } from "../../lib/api";

const fieldLabels = {
    modelName: "Nom du modèle",
    photo: "Photo"
};

const emptyValues = {
    modelName: "",
    photo: ""
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

export default function PdfTemplatesPage() {
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [values, setValues] = useState(emptyValues);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewObjectUrl, setPreviewObjectUrl] = useState("");
    const [error, setError] = useState("");
    const [previewError, setPreviewError] = useState("");
    const [generatedDocument, setGeneratedDocument] = useState(null);

    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const res = await apiFetch("/pdf-templates");
                const data = await res.json();
                if (!data.success) {
                    setError(data.message || "Impossible de charger les modèles PDF.");
                    return;
                }

                const nextTemplates = data.templates || [];
                setTemplates(nextTemplates);
                setSelectedTemplateId(nextTemplates[0]?.id || "");
            } catch {
                setError("Erreur de connexion au serveur.");
            } finally {
                setLoading(false);
            }
        };

        loadTemplates();
    }, []);

    const selectedTemplate = useMemo(
        () => templates.find(template => template.id === selectedTemplateId),
        [templates, selectedTemplateId]
    );

    const selectedFields = useMemo(
        () => Object.entries(selectedTemplate?.fields || {}),
        [selectedTemplate]
    );

    useEffect(() => {
        if (!selectedTemplateId) {
            setPreviewObjectUrl("");
            setPreviewError("");
            return undefined;
        }

        let active = true;
        let objectUrl = "";

        const loadPreview = async () => {
            setPreviewLoading(true);
            setPreviewError("");

            try {
                const res = await apiFetch(`/pdf-templates/${selectedTemplateId}/preview`, {
                    method: "GET"
                });

                if (!res.ok) {
                    setPreviewError("Impossible de charger la prévisualisation du modèle.");
                    return;
                }

                const blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);
                if (active) setPreviewObjectUrl(objectUrl);
            } catch {
                setPreviewError("Erreur lors du chargement de la prévisualisation.");
            } finally {
                if (active) setPreviewLoading(false);
            }
        };

        loadPreview();

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [selectedTemplateId]);

    const handleInputChange = (fieldName, value) => {
        setValues(current => ({ ...current, [fieldName]: value }));
        setGeneratedDocument(null);
    };

    const handlePhotoChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!["image/png", "image/jpeg"].includes(file.type)) {
            setError("La photo doit être au format PNG ou JPEG.");
            return;
        }

        const dataUrl = await readFileAsDataUrl(file);
        handleInputChange("photo", dataUrl);
    };

    const handleGenerate = async (event) => {
        event.preventDefault();
        setError("");
        setGenerating(true);
        setGeneratedDocument(null);

        const payloadValues = selectedFields.reduce((payload, [fieldName, field]) => {
            if (field.type === "image") {
                if (values[fieldName]) payload[fieldName] = values[fieldName];
                return payload;
            }

            payload[fieldName] = values[fieldName] || "";
            return payload;
        }, {});

        try {
            const res = await apiFetch("/pdf-templates/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateId: selectedTemplateId,
                    values: payloadValues
                })
            });
            const data = await res.json();

            if (!data.success) {
                setError(data.message || "Erreur lors de la génération du PDF.");
                return;
            }

            setGeneratedDocument(data.document);
        } catch {
            setError("Erreur de connexion au serveur.");
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            {/* **************************************** */}
            {/* En-tête et réinitialisation du formulaire */}
            {/* **************************************** */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-950 dark:text-white">Modèles PDF</h1>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Choisissez un modèle, donnez-lui un nom, prévisualisez le document et téléchargez le PDF final.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setValues(emptyValues);
                        setGeneratedDocument(null);
                        setError("");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                    <RefreshCw className="h-4 w-4" />
                    Réinitialiser
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* **************************************** */}
            {/* Saisie des informations et aperçu du document */}
            {/* **************************************** */}
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-200">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-950 dark:text-white">Formulaire</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Organisation et identifiant sont ajoutés automatiquement.</p>
                        </div>
                    </div>

                    {/* **************************************** */}
                    {/* Formulaire de génération du PDF */}
                    {/* **************************************** */}
                    <form onSubmit={handleGenerate} className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Modèle</label>
                            <select
                                value={selectedTemplateId}
                                onChange={(event) => {
                                    setSelectedTemplateId(event.target.value);
                                    setGeneratedDocument(null);
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                                {templates.map(template => (
                                    <option key={template.id} value={template.id}>{template.name}</option>
                                ))}
                            </select>
                            {selectedTemplate?.description && (
                                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedTemplate.description}</p>
                            )}
                        </div>

                        {selectedFields.map(([fieldName, field]) => (
                            <div key={fieldName}>
                                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {fieldLabels[fieldName] || fieldName}
                                    {field.required ? <span className="text-red-500"> *</span> : null}
                                </label>

                                {field.type === "image" ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-900">
                                            <ImagePlus className="h-4 w-4" />
                                            Ajouter une image
                                            <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} className="hidden" />
                                        </label>
                                        {values[fieldName] ? (
                                            <img src={values[fieldName]} alt="Aperçu" className="mt-4 h-32 w-32 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                                        ) : null}
                                    </div>
                                ) : (
                                    <input
                                        value={values[fieldName] || ""}
                                        onChange={(event) => handleInputChange(fieldName, event.target.value)}
                                        required={field.required}
                                        placeholder={fieldLabels[fieldName] || fieldName}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                )}
                            </div>
                        ))}

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Le document sera automatiquement rattaché à votre organisation. L'identifiant unique est généré par le serveur au moment de la création du PDF.
                        </div>

                        <button
                            type="submit"
                            disabled={generating || !selectedTemplateId}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/15 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Générer le PDF
                        </button>
                    </form>

                    {generatedDocument && (
                        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                            <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">PDF généré avec succès</p>
                            <a
                                href={apiUrl(generatedDocument.downloadUrl)}
                                download
                                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
                            >
                                <Download className="h-4 w-4" />
                                Télécharger le PDF
                            </a>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-4">
                        <h2 className="text-base font-black text-slate-950 dark:text-white">Prévisualisation du modèle</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aperçu du modèle sélectionné avant génération.</p>
                    </div>
                    <div className="h-[680px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                        {previewLoading ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : previewObjectUrl ? (
                            <iframe
                                key={previewObjectUrl}
                                src={previewObjectUrl}
                                title="Prévisualisation du modèle PDF"
                                className="h-full w-full"
                            />
                        ) : previewError ? (
                            <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-red-600 dark:text-red-300">
                                {previewError}
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                                Aucun modèle sélectionné.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
