"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Crown, Loader2, Mail, Save } from "lucide-react";
import { apiFetch } from "../../lib/api";
import LoadingBar from "../../components/LoadingBar";
import { CARD_TEMPLATE_STORAGE_KEY, cardTemplates } from "../../lib/cardTemplates";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";

function WeddingTemplatePreview({ template }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="relative mx-auto aspect-[1240/1748] max-h-[560px] w-full overflow-hidden bg-white">
                {template.previewImage ? (
                    <img
                        src={`${apiBaseUrl}${template.previewImage}`}
                        alt={template.name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                        Aperçu indisponible
                    </div>
                )}
                <div className="absolute inset-x-8 top-[30%] text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#080d5f] sm:text-xs">Je t'invite à notre mariage</p>
                    <p className="mt-8 font-serif text-4xl font-bold italic tracking-[0.16em] text-[#080d5f] sm:text-6xl">NOM 1</p>
                    <p className="my-5 font-serif text-3xl italic text-[#080d5f]">&amp;</p>
                    <p className="font-serif text-4xl font-bold italic tracking-[0.16em] text-[#080d5f] sm:text-6xl">NOM 2</p>
                </div>
            </div>
        </div>
    );
}

export default function CardTemplatesPage() {
    const [selectedId, setSelectedId] = useState(cardTemplates[0].id);
    const [savedTemplateId, setSavedTemplateId] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const selectedTemplate = useMemo(
        () => cardTemplates.find(template => template.id === selectedId) || cardTemplates[0],
        [selectedId]
    );

    useEffect(() => {
        const fetchDefaultTemplate = async () => {
            setLoading(true);
            try {
                const res = await apiFetch("/card-templates/default");
                const data = await res.json();
                const defaultTemplateId = data.success ? data.defaultTemplateId || "" : "";
                const nextTemplateId = defaultTemplateId || window.localStorage.getItem(CARD_TEMPLATE_STORAGE_KEY) || cardTemplates[0].id;
                setSavedTemplateId(defaultTemplateId);
                setSelectedId(cardTemplates.some(template => template.id === nextTemplateId) ? nextTemplateId : cardTemplates[0].id);
            } finally {
                setLoading(false);
            }
        };
        fetchDefaultTemplate();
    }, []);

    const handleSetDefault = async () => {
        setSaving(true);
        try {
            const res = await apiFetch("/card-templates/default", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateId: selectedTemplate.id })
            });
            const data = await res.json();
            if (data.success) {
                window.localStorage.setItem(CARD_TEMPLATE_STORAGE_KEY, data.defaultTemplateId);
                setSavedTemplateId(data.defaultTemplateId);
                setStatusMessage("Modèle par défaut mis à jour.");
                setTimeout(() => setStatusMessage(""), 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                        <Crown className="h-3.5 w-3.5" />
                        Modèles prédéfinis
                    </div>
                    <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Invitations de mariage</h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                        Choisissez le modèle qui sera utilisé automatiquement lors de la création des QR.
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    Modèle actif : <span className="font-semibold text-slate-900 dark:text-white">{savedTemplateId ? cardTemplates.find(template => template.id === savedTemplateId)?.name || "Modèle défini" : "Aucun"}</span>
                </div>
            </div>

            {loading && <LoadingBar label="Chargement du modèle actif" />}
            {statusMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {statusMessage}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                <section className="space-y-3">
                    {cardTemplates.map((template) => {
                        const isSelected = template.id === selectedId;
                        const isActive = template.id === savedTemplateId;
                        return (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => setSelectedId(template.id)}
                                className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-all dark:bg-slate-950 ${isSelected ? "border-[#080d5f] ring-2 ring-[#080d5f]/15 dark:border-blue-400" : "border-slate-200 hover:border-[#7A90A4] dark:border-slate-800"}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="rounded-xl bg-blue-50 p-2.5 text-[#080d5f] dark:bg-blue-950/30 dark:text-blue-200">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-bold text-slate-900 dark:text-white">{template.name}</h2>
                                            {isActive && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                        </div>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{template.description}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <WeddingTemplatePreview template={selectedTemplate} />
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTemplate.name}</h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedTemplate.format}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Champs demandés à la création QR</h3>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedTemplate.fields.map(field => (
                                        <span key={field} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                            {field}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleSetDefault}
                                disabled={saving || savedTemplateId === selectedTemplate.id}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#080d5f] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#101875] disabled:opacity-60"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {savedTemplateId === selectedTemplate.id ? "Modèle déjà actif" : "Définir comme modèle par défaut"}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
