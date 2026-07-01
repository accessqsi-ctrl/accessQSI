"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Copy, Crown, IdCard, Loader2, Mail, QrCode, Save, ShieldCheck, Sparkles, Ticket, Trash2, Upload } from "lucide-react";
import { apiFetch } from "../../lib/api";
import LoadingBar from "../../components/LoadingBar";
import { CARD_TEMPLATE_STORAGE_KEY, cardTemplates, defaultVisibleFields, getBaseCardTemplate, normalizeCustomCardTemplate } from "../../lib/cardTemplates";

const templateIcons = {
    "event-ticket": Ticket,
    "access-pass": ShieldCheck,
    "staff-card": IdCard,
    "staff-badge-horizontal": IdCard,
    "wedding-invite": Mail,
    "vip-invitation": Sparkles,
    "vip-pass": Sparkles,
    "simple-invitation": Mail,
    "compact-ticket": Ticket
};

const accentStyles = {
    blue: {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
        solid: "bg-blue-600",
        soft: "bg-blue-100"
    },
    emerald: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        solid: "bg-emerald-600",
        soft: "bg-emerald-100"
    },
    rose: {
        bg: "bg-rose-50",
        text: "text-rose-700",
        border: "border-rose-200",
        solid: "bg-rose-600",
        soft: "bg-rose-100"
    },
    amber: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        solid: "bg-amber-600",
        soft: "bg-amber-100"
    },
    violet: {
        bg: "bg-violet-50",
        text: "text-violet-700",
        border: "border-violet-200",
        solid: "bg-violet-600",
        soft: "bg-violet-100"
    },
    teal: {
        bg: "bg-teal-50",
        text: "text-teal-700",
        border: "border-teal-200",
        solid: "bg-teal-600",
        soft: "bg-teal-100"
    },
    slate: {
        bg: "bg-slate-50",
        text: "text-slate-700",
        border: "border-slate-200",
        solid: "bg-slate-700",
        soft: "bg-slate-100"
    }
};

function TemplatePreview({ template }) {
    const styles = accentStyles[template.accent] || accentStyles.slate;
    const isWide = template.layout === "wide";
    const isCompact = template.layout === "compact";
    const isStaff = template.layout === "badge";
    const customColors = template.accent === "custom";

    return (
        <div
            className={`relative overflow-hidden border ${styles.border} ${styles.bg} ${isWide ? "aspect-[16/6]" : isCompact ? "aspect-[12/5]" : "aspect-[9/14]"} rounded-xl`}
            style={customColors ? { borderColor: template.primaryColor, backgroundColor: template.secondaryColor } : undefined}
        >
            <div
                className={`absolute left-0 top-0 h-full ${isWide ? "w-1/3" : "w-full h-1/4"} ${customColors ? "" : styles.solid}`}
                style={customColors ? { backgroundColor: template.primaryColor } : undefined}
            />
            <div className="absolute inset-4 flex flex-col justify-between">
                <div className={isWide ? "ml-[34%]" : "mt-[42%]"}>
                    <div
                        className={`inline-flex items-center gap-1.5 rounded-full ${customColors ? "bg-white/85 text-slate-800" : `${styles.soft} ${styles.text}`} px-2.5 py-1 text-[10px] font-bold uppercase`}
                    >
                        <BadgeCheck className="h-3 w-3" />
                        {template.category}
                    </div>
                    <div className="mt-3 h-3 w-28 rounded-full bg-slate-900/80" />
                    <div className="mt-2 h-2 w-20 rounded-full bg-slate-500/40" />
                    <div className="mt-2 h-2 w-24 rounded-full bg-slate-500/30" />
                </div>
                <div className={`flex items-end ${isStaff ? "justify-center" : "justify-between"}`}>
                    {!isStaff && (
                        <div className="space-y-1.5">
                            <div className="h-2 w-16 rounded-full bg-slate-500/30" />
                            <div className="h-2 w-12 rounded-full bg-slate-500/20" />
                        </div>
                    )}
                    <div className="grid h-16 w-16 grid-cols-3 gap-1 rounded-lg bg-white p-2 shadow-sm">
                        {Array.from({ length: 9 }).map((_, index) => (
                            <div key={index} className={`rounded-sm ${index % 2 === 0 ? "bg-slate-900" : "bg-slate-300"}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CardTemplatesPage() {
    const [selectedId, setSelectedId] = useState(cardTemplates[0].id);
    const [savedTemplateId, setSavedTemplateId] = useState("");
    const [customTemplates, setCustomTemplates] = useState([]);
    const [loadingCustom, setLoadingCustom] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [editor, setEditor] = useState(null);
    const allTemplates = useMemo(() => [...cardTemplates, ...customTemplates], [customTemplates]);
    const selectedTemplate = useMemo(
        () => allTemplates.find(template => template.id === selectedId) || allTemplates[0] || cardTemplates[0],
        [allTemplates, selectedId]
    );
    const SelectedIcon = templateIcons[selectedTemplate.id] || Ticket;
    const selectedStyles = accentStyles[selectedTemplate.accent] || accentStyles.slate;
    const isCustomSelected = Boolean(selectedTemplate.customId);

    const buildEditorFromTemplate = (template) => ({
        customId: template.customId || null,
        baseTemplateId: template.baseTemplateId || template.id,
        name: template.customId ? template.name : `${template.name} personnalisé`,
        primaryColor: template.primaryColor || "#2563eb",
        secondaryColor: template.secondaryColor || "#dbeafe",
        title: template.title || template.name.toUpperCase(),
        cardMessageDefault: template.cardMessageDefault || "Présentez ce QR à l'entrée",
        logoUrl: template.logoUrl || "",
        qrPosition: template.qrPosition || "right",
        visibleFields: { ...defaultVisibleFields, ...(template.visibleFields || {}) },
        layout: template.layout || "wide"
    });

    const previewTemplate = useMemo(() => {
        if (!editor) return selectedTemplate;
        const base = getBaseCardTemplate(editor.baseTemplateId);
        return {
            ...base,
            id: editor.customId ? `custom:${editor.customId}` : "draft",
            name: editor.name || "Modèle personnalisé",
            category: "Personnalisé",
            accent: "custom",
            primaryColor: editor.primaryColor,
            secondaryColor: editor.secondaryColor,
            title: editor.title,
            logoUrl: editor.logoUrl,
            qrPosition: editor.qrPosition,
            visibleFields: editor.visibleFields,
            layout: editor.layout || base.layout,
            fields: Object.entries(editor.visibleFields).filter(([, value]) => value).map(([key]) => key)
        };
    }, [editor, selectedTemplate]);

    const fetchCustomTemplates = async () => {
        setLoadingCustom(true);
        try {
            const res = await apiFetch("/card-templates/custom");
            const data = await res.json();
            if (data.success) {
                setCustomTemplates((data.templates || []).map(normalizeCustomCardTemplate));
                setSavedTemplateId(data.defaultTemplateId || window.localStorage.getItem(CARD_TEMPLATE_STORAGE_KEY) || "");
            }
        } finally {
            setLoadingCustom(false);
        }
    };

    useEffect(() => {
        setSavedTemplateId(window.localStorage.getItem(CARD_TEMPLATE_STORAGE_KEY) || "");
        fetchCustomTemplates();
    }, []);

    useEffect(() => {
        setEditor(buildEditorFromTemplate(selectedTemplate));
    }, [selectedTemplate.id]);

    const handleEnableTemplate = async (templateId = selectedTemplate.id) => {
        const res = await apiFetch("/card-templates/default", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateId })
        });
        const data = await res.json();
        if (data.success) {
            window.localStorage.setItem(CARD_TEMPLATE_STORAGE_KEY, data.defaultTemplateId);
            setSavedTemplateId(data.defaultTemplateId);
            setStatusMessage("Modèle par défaut mis à jour.");
            setTimeout(() => setStatusMessage(""), 3000);
        }
    };

    const handleDisableTemplate = async () => {
        const res = await apiFetch("/card-templates/default", { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            window.localStorage.removeItem(CARD_TEMPLATE_STORAGE_KEY);
            setSavedTemplateId("");
            setStatusMessage("Modèle par défaut retiré.");
            setTimeout(() => setStatusMessage(""), 3000);
        }
    };

    const handleSaveCustom = async () => {
        setSaving(true);
        try {
            const path = editor.customId ? `/card-templates/custom/${editor.customId}` : "/card-templates/custom";
            const res = await apiFetch(path, {
                method: editor.customId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editor)
            });
            const data = await res.json();
            if (data.success) {
                const normalized = normalizeCustomCardTemplate(data.template);
                setCustomTemplates(prev => {
                    const others = prev.filter(template => template.customId !== normalized.customId);
                    return [normalized, ...others];
                });
                setSelectedId(normalized.id);
                await handleEnableTemplate(normalized.id);
                setStatusMessage("Modèle personnalisé sauvegardé.");
                setTimeout(() => setStatusMessage(""), 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDuplicateCustom = async () => {
        if (!editor?.customId) return;
        setSaving(true);
        try {
            const res = await apiFetch(`/card-templates/custom/${editor.customId}/duplicate`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                const normalized = normalizeCustomCardTemplate(data.template);
                setCustomTemplates(prev => [normalized, ...prev]);
                setSelectedId(normalized.id);
                setStatusMessage("Modèle dupliqué.");
                setTimeout(() => setStatusMessage(""), 3000);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append("logo", file);
        setUploadingLogo(true);
        try {
            const res = await apiFetch("/card-templates/logo", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setEditor(prev => ({ ...prev, logoUrl: data.logoUrl }));
                setStatusMessage("Logo ajouté au modèle.");
                setTimeout(() => setStatusMessage(""), 3000);
            }
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleDeleteCustom = async () => {
        if (!editor?.customId) return;
        setDeleting(true);
        try {
            const res = await apiFetch(`/card-templates/custom/${editor.customId}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setCustomTemplates(prev => prev.filter(template => template.customId !== editor.customId));
                if (savedTemplateId === `custom:${editor.customId}`) handleDisableTemplate();
                setSelectedId(cardTemplates[0].id);
            }
        } finally {
            setDeleting(false);
        }
    };

    const toggleField = (field) => {
        setEditor(prev => ({
            ...prev,
            visibleFields: { ...prev.visibleFields, [field]: !prev.visibleFields[field] }
        }));
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        <Crown className="h-3.5 w-3.5" />
                        Module cartes
                    </div>
                    <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Modèles de cartes</h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                        Préparez les supports qui recevront automatiquement le QR code et les informations du titulaire.
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    Modèle par défaut : <span className="font-semibold text-slate-900 dark:text-white">{savedTemplateId ? allTemplates.find(template => template.id === savedTemplateId)?.name || "Modèle personnalisé" : "QR seul"}</span>
                </div>
            </div>

            {loadingCustom && <LoadingBar label="Chargement des modèles personnalisés" />}
            {statusMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {statusMessage}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <section className="grid gap-4 md:grid-cols-3">
                    {allTemplates.map((template) => {
                        const Icon = templateIcons[template.id] || Ticket;
                        const styles = accentStyles[template.accent] || accentStyles.slate;
                        const isSelected = template.id === selectedId;

                        return (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => setSelectedId(template.id)}
                                className={`text-left rounded-2xl border bg-white p-4 shadow-sm transition-all dark:bg-slate-950 ${isSelected ? `${styles.border} ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950 ring-slate-500/20` : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-600"}`}
                            >
                                <TemplatePreview template={template} />
                                <div className="mt-4 flex items-start gap-3">
                                    <div className={`rounded-xl ${styles.bg} ${styles.text} p-2`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="font-bold text-slate-900 dark:text-white">{template.name}</h2>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{template.description}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </section>

                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className={`rounded-xl ${selectedStyles.bg} ${selectedStyles.text} p-2.5`}>
                            <SelectedIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-white">{selectedTemplate.name}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{selectedTemplate.format}</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <TemplatePreview template={previewTemplate} />
                    </div>

                    {editor && (
                        <div className="mt-5 space-y-4">
                            {(saving || deleting) && (
                                <LoadingBar label={saving ? "Sauvegarde du modèle" : "Suppression du modèle"} />
                            )}

                            <div className="grid grid-cols-1 gap-3">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Nom</span>
                                    <input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Titre sur carte</span>
                                    <input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Couleur principale</span>
                                    <input type="color" value={editor.primaryColor} onChange={(e) => setEditor({ ...editor, primaryColor: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Couleur douce</span>
                                    <input type="color" value={editor.secondaryColor} onChange={(e) => setEditor({ ...editor, secondaryColor: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" />
                                </label>
                            </div>

                            <label className="space-y-1.5 block">
                                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Message par défaut</span>
                                <input value={editor.cardMessageDefault} onChange={(e) => setEditor({ ...editor, cardMessageDefault: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                            </label>

                            <label className="space-y-1.5 block">
                                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Logo URL</span>
                                <input value={editor.logoUrl} onChange={(e) => setEditor({ ...editor, logoUrl: e.target.value })} placeholder="https://..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                            </label>

                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900">
                                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Importer un logo
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="sr-only"
                                    onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                                />
                            </label>

                            <label className="space-y-1.5 block">
                                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Position QR</span>
                                <select value={editor.qrPosition} onChange={(e) => setEditor({ ...editor, qrPosition: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                                    <option value="right">Droite</option>
                                    <option value="left">Gauche</option>
                                    <option value="center">Centre</option>
                                </select>
                            </label>

                            <div>
                                <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Champs visibles</h3>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {Object.keys(defaultVisibleFields).map(field => (
                                        <button
                                            key={field}
                                            type="button"
                                            onClick={() => toggleField(field)}
                                            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${editor.visibleFields[field] ? "border-[#7A90A4] bg-[#7A90A4]/15 text-slate-900 dark:text-white" : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"}`}
                                        >
                                            {field}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveCustom}
                                disabled={saving}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {isCustomSelected ? "Enregistrer le modèle" : "Créer une variante"}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleEnableTemplate()}
                                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors ${selectedTemplate.accent === "custom" ? "bg-slate-900 dark:bg-slate-100 dark:text-slate-900" : selectedStyles.solid}`}
                            >
                                Définir comme modèle par défaut
                            </button>
                            {savedTemplateId === selectedTemplate.id && (
                                <p className="text-center text-xs font-medium text-emerald-600">
                                    Ce modèle sera sélectionné automatiquement dans la génération QR.
                                </p>
                            )}

                            {isCustomSelected && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={handleDuplicateCustom}
                                        disabled={saving}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                                    >
                                        <Copy className="h-4 w-4" />
                                        Dupliquer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteCustom}
                                        disabled={deleting}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                                    >
                                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        Supprimer
                                    </button>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleDisableTemplate}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                                Revenir à QR seul par défaut
                            </button>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
