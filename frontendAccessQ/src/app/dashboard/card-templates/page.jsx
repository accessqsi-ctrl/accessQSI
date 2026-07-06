"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Copy, Crown, IdCard, Layers, Loader2, Mail, QrCode, Save, ShieldCheck, Sparkles, Ticket, Trash2, Upload } from "lucide-react";
import { apiFetch } from "../../lib/api";
import LoadingBar from "../../components/LoadingBar";
import { CARD_TEMPLATE_STORAGE_KEY, cardElementLabels, cardTemplates, createDefaultLayoutConfig, defaultVisibleFields, getBaseCardTemplate, normalizeCustomCardTemplate } from "../../lib/cardTemplates";

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

function CompositionPreview({ template, selectedType, onSelect, onUpdate }) {
    const previewRef = useRef(null);
    const [interaction, setInteraction] = useState(null);
    const base = getBaseCardTemplate(template.baseTemplateId || template.id);
    const isWide = base.layout === "wide" || base.layout === "compact";
    const elements = [...(template.layoutConfig?.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const sampleValues = {
        logo: "Logo",
        title: template.title || "INVITATION",
        event: "Gala QR Access",
        holder: "Jane Mukeba",
        date: "01 juillet 2026",
        location: "Salle principale",
        level: "Niveau 1",
        message: template.cardMessageDefault || "Présentez ce QR à l'entrée",
        cardId: "QR-1024"
    };

    const startInteraction = (event, element, mode) => {
        event.preventDefault();
        event.stopPropagation();
        if (element.locked) return;
        onSelect(element.type);
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setInteraction({
            mode,
            type: element.type,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            original: { ...element }
        });
    };

    const handlePointerMove = (event) => {
        if (!interaction || !previewRef.current) return;
        const rect = previewRef.current.getBoundingClientRect();
        const dx = ((event.clientX - interaction.startX) / rect.width) * base.width;
        const dy = ((event.clientY - interaction.startY) / rect.height) * base.height;
        if (interaction.mode === "resize") {
            onUpdate(interaction.type, {
                width: Math.max(20, Math.round(interaction.original.width + dx)),
                height: Math.max(20, Math.round(interaction.original.height + dy))
            });
            return;
        }
        onUpdate(interaction.type, {
            x: Math.max(0, Math.round(interaction.original.x + dx)),
            y: Math.max(0, Math.round(interaction.original.y + dy))
        });
    };

    const stopInteraction = () => setInteraction(null);

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div
                ref={previewRef}
                onPointerMove={handlePointerMove}
                onPointerUp={stopInteraction}
                onPointerCancel={stopInteraction}
                className={`relative mx-auto overflow-hidden rounded-lg bg-white shadow-sm ${isWide ? "aspect-[16/6]" : "aspect-[9/13]"}`}
                style={{
                    maxWidth: "100%",
                    backgroundColor: template.secondaryColor,
                    backgroundImage: template.backgroundImageUrl ? `url(${template.backgroundImageUrl})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                }}
            >
                <div className="absolute inset-0 bg-white/70" />
                {elements.map((element) => {
                    const selected = selectedType === element.type;
                    const style = {
                        left: `${(element.x / base.width) * 100}%`,
                        top: `${(element.y / base.height) * 100}%`,
                        width: `${(element.width / base.width) * 100}%`,
                        height: `${(element.height / base.height) * 100}%`,
                        color: element.color,
                        fontSize: `${Math.max(8, (element.fontSize / base.width) * 100)}vw`,
                        fontWeight: element.fontWeight,
                        textAlign: element.align,
                        opacity: element.visible ? 1 : 0.28,
                        borderColor: selected ? "#2563eb" : "transparent",
                        zIndex: element.zIndex || 0
                    };
                    return (
                        <button
                            key={element.type}
                            type="button"
                            onPointerDown={(event) => startInteraction(event, element, "move")}
                            className={`absolute overflow-hidden rounded-md border border-dashed bg-white/20 px-1 text-left transition-colors hover:border-[#7A90A4] ${element.locked ? "cursor-not-allowed" : "cursor-move"}`}
                            style={style}
                            title={cardElementLabels[element.type] || element.type}
                        >
                            {element.type === "qr" ? (
                                <span className="grid h-full w-full grid-cols-3 gap-0.5 rounded bg-white p-1">
                                    {Array.from({ length: 9 }).map((_, index) => <span key={index} className={index % 2 ? "bg-slate-300" : "bg-slate-900"} />)}
                                </span>
                            ) : element.type === "logo" ? (
                                <span className="flex h-full items-center justify-center rounded bg-white/80 text-[10px] font-bold text-slate-700">LOGO</span>
                            ) : (
                                <span className="block truncate leading-tight">{sampleValues[element.type] || element.label}</span>
                            )}
                            {selected && !element.locked && (
                                <span
                                    onPointerDown={(event) => startInteraction(event, element, "resize")}
                                    className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-tl bg-blue-600"
                                />
                            )}
                        </button>
                    );
                })}
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
    const [uploadingBackground, setUploadingBackground] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [editor, setEditor] = useState(null);
    const [selectedElementType, setSelectedElementType] = useState("event");
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
        backgroundImageUrl: template.backgroundImageUrl || "",
        qrPosition: template.qrPosition || "right",
        visibleFields: { ...defaultVisibleFields, ...(template.visibleFields || {}) },
        layoutConfig: template.layoutConfig || createDefaultLayoutConfig(template.baseTemplateId || template.id),
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
            backgroundImageUrl: editor.backgroundImageUrl,
            qrPosition: editor.qrPosition,
            visibleFields: editor.visibleFields,
            layoutConfig: editor.layoutConfig,
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
        setSelectedElementType("event");
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

    const handleBackgroundUpload = async (file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append("background", file);
        setUploadingBackground(true);
        try {
            const res = await apiFetch("/card-templates/background", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setEditor(prev => ({ ...prev, backgroundImageUrl: data.backgroundImageUrl }));
                setStatusMessage("Image de fond ajoutée.");
                setTimeout(() => setStatusMessage(""), 3000);
            }
        } finally {
            setUploadingBackground(false);
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

    const selectedElement = editor?.layoutConfig?.elements?.find(element => element.type === selectedElementType) || null;
    const updateElementByType = (type, updates) => {
        setEditor(prev => ({
            ...prev,
            layoutConfig: {
                ...(prev.layoutConfig || { version: 2, backgroundOpacity: 0.72, elements: [] }),
                elements: (prev.layoutConfig?.elements || []).map(element => (
                    element.type === type ? { ...element, ...updates } : element
                ))
            }
        }));
    };

    const updateSelectedElement = (updates) => {
        updateElementByType(selectedElementType, updates);
    };

    const resetLayout = () => {
        setEditor(prev => ({
            ...prev,
            layoutConfig: createDefaultLayoutConfig(prev.baseTemplateId)
        }));
        setSelectedElementType("event");
    };

    const updateBackgroundOpacity = (value) => {
        setEditor(prev => ({
            ...prev,
            layoutConfig: {
                ...(prev.layoutConfig || createDefaultLayoutConfig(prev.baseTemplateId)),
                backgroundOpacity: Number(value)
            }
        }));
    };

    const moveLayer = (type, direction) => {
        const elements = editor?.layoutConfig?.elements || [];
        const current = elements.find(element => element.type === type);
        if (!current) return;
        updateElementByType(type, { zIndex: Math.max(0, (current.zIndex || 0) + direction) });
    };

    const alignSelected = (mode) => {
        if (!selectedElement) return;
        const base = getBaseCardTemplate(editor.baseTemplateId);
        const updates = {
            centerH: { x: Math.round((base.width - selectedElement.width) / 2) },
            centerV: { y: Math.round((base.height - selectedElement.height) / 2) },
            left: { x: 80, align: "left" },
            right: { x: Math.max(0, base.width - selectedElement.width - 80), align: "right" }
        }[mode];
        if (updates) updateSelectedElement(updates);
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
                    <div className="mt-4">
                        <CompositionPreview template={previewTemplate} selectedType={selectedElementType} onSelect={setSelectedElementType} onUpdate={updateElementByType} />
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

                            <label className="space-y-1.5 block">
                                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Image de fond URL</span>
                                <input value={editor.backgroundImageUrl} onChange={(e) => setEditor({ ...editor, backgroundImageUrl: e.target.value })} placeholder="https://..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                            </label>

                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900">
                                {uploadingBackground ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Importer une image de fond
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="sr-only"
                                    onChange={(event) => handleBackgroundUpload(event.target.files?.[0])}
                                />
                            </label>

                            <label className="space-y-1.5 block">
                                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Opacité fond</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={editor.layoutConfig?.backgroundOpacity ?? 0.72}
                                    onChange={(event) => updateBackgroundOpacity(event.target.value)}
                                    className="w-full accent-blue-600"
                                />
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

                            <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                        <Layers className="h-3.5 w-3.5" />
                                        Calques
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={resetLayout}
                                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                    >
                                        Réinitialiser
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {[...(editor.layoutConfig?.elements || [])].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).map(element => (
                                        <button
                                            key={element.type}
                                            type="button"
                                            onClick={() => setSelectedElementType(element.type)}
                                            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${selectedElementType === element.type ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200" : "border-slate-200 text-slate-600 hover:border-[#7A90A4] dark:border-slate-800 dark:text-slate-300"}`}
                                        >
                                            <span>{cardElementLabels[element.type] || element.label}</span>
                                            <span className="text-[10px] opacity-70">
                                                {element.visible ? "visible" : "masqué"}{element.locked ? " / verrouillé" : ""}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {selectedElement && (
                                    <div className="mt-4 space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button type="button" onClick={() => alignSelected("centerH")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Centrer H</button>
                                            <button type="button" onClick={() => alignSelected("centerV")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Centrer V</button>
                                            <button type="button" onClick={() => alignSelected("left")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Gauche</button>
                                            <button type="button" onClick={() => alignSelected("right")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Droite</button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                ["x", "X"],
                                                ["y", "Y"],
                                                ["width", "Largeur"],
                                                ["height", "Hauteur"],
                                                ["fontSize", "Police"]
                                            ].map(([key, label]) => (
                                                <label key={key} className="space-y-1.5">
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                                                    <input
                                                        type="number"
                                                        value={selectedElement[key]}
                                                        onChange={(event) => updateSelectedElement({ [key]: Number(event.target.value) })}
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                                    />
                                                </label>
                                            ))}
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Opacité</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={selectedElement.opacity ?? 1}
                                                    onChange={(event) => updateSelectedElement({ opacity: Number(event.target.value) })}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                                />
                                            </label>
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Couleur</span>
                                                <input
                                                    type="color"
                                                    value={selectedElement.color}
                                                    onChange={(event) => updateSelectedElement({ color: event.target.value })}
                                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
                                                />
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Alignement</span>
                                                <select
                                                    value={selectedElement.align}
                                                    onChange={(event) => updateSelectedElement({ align: event.target.value })}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                                >
                                                    <option value="left">Gauche</option>
                                                    <option value="center">Centre</option>
                                                    <option value="right">Droite</option>
                                                </select>
                                            </label>
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Graisse</span>
                                                <select
                                                    value={selectedElement.fontWeight}
                                                    onChange={(event) => updateSelectedElement({ fontWeight: event.target.value })}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                                >
                                                    <option value="400">Regular</option>
                                                    <option value="600">Semi-bold</option>
                                                    <option value="700">Bold</option>
                                                    <option value="900">Black</option>
                                                </select>
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => moveLayer(selectedElement.type, 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Avant</button>
                                            <button type="button" onClick={() => moveLayer(selectedElement.type, -1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Arrière</button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => updateSelectedElement({ visible: !selectedElement.visible })}
                                            className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${selectedElement.visible ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"}`}
                                        >
                                            {selectedElement.visible ? "Visible" : "Masqué"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateSelectedElement({ locked: !selectedElement.locked })}
                                            className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${selectedElement.locked ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"}`}
                                        >
                                            {selectedElement.locked ? "Verrouillé" : "Déverrouillé"}
                                        </button>
                                    </div>
                                )}
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
