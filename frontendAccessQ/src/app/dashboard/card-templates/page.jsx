"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Calendar, Crown, IdCard, Mail, QrCode, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { CARD_TEMPLATE_STORAGE_KEY, cardTemplates } from "../../lib/cardTemplates";

const templateIcons = {
    "event-ticket": Ticket,
    "access-pass": ShieldCheck,
    "staff-card": IdCard,
    "wedding-invite": Mail,
    "vip-invitation": Sparkles
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
    }
};

function TemplatePreview({ template }) {
    const styles = accentStyles[template.accent];
    const isWide = template.layout === "wide";
    const isStaff = template.layout === "badge";

    return (
        <div className={`relative overflow-hidden border ${styles.border} ${styles.bg} ${isWide ? "aspect-[16/6]" : "aspect-[9/14]"} rounded-xl`}>
            <div className={`absolute left-0 top-0 h-full ${isWide ? "w-1/3" : "w-full h-1/4"} ${styles.solid}`} />
            <div className="absolute inset-4 flex flex-col justify-between">
                <div className={isWide ? "ml-[34%]" : "mt-[42%]"}>
                    <div className={`inline-flex items-center gap-1.5 rounded-full ${styles.soft} ${styles.text} px-2.5 py-1 text-[10px] font-bold uppercase`}>
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
    const selectedTemplate = useMemo(
        () => cardTemplates.find(template => template.id === selectedId) || cardTemplates[0],
        [selectedId]
    );
    const SelectedIcon = templateIcons[selectedTemplate.id] || Ticket;
    const selectedStyles = accentStyles[selectedTemplate.accent];

    useEffect(() => {
        setSavedTemplateId(window.localStorage.getItem(CARD_TEMPLATE_STORAGE_KEY) || "");
    }, []);

    const handleEnableTemplate = () => {
        window.localStorage.setItem(CARD_TEMPLATE_STORAGE_KEY, selectedTemplate.id);
        setSavedTemplateId(selectedTemplate.id);
    };

    const handleDisableTemplate = () => {
        window.localStorage.removeItem(CARD_TEMPLATE_STORAGE_KEY);
        setSavedTemplateId("");
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
                    Modèle par défaut : <span className="font-semibold text-slate-900 dark:text-white">{savedTemplateId ? cardTemplates.find(template => template.id === savedTemplateId)?.name : "QR seul"}</span>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <section className="grid gap-4 md:grid-cols-3">
                    {cardTemplates.map((template) => {
                        const Icon = templateIcons[template.id] || Ticket;
                        const styles = accentStyles[template.accent];
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
                        <TemplatePreview template={selectedTemplate} />
                    </div>

                    <div className="mt-5 space-y-4">
                        <div>
                            <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Champs prévus</h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {selectedTemplate.fields.map(field => (
                                    <span key={field} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
                                        {field}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                <QrCode className="h-4 w-4 text-slate-400" />
                                <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-white">QR automatique</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-white">Données événement</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleEnableTemplate}
                            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors ${selectedStyles.solid}`}
                        >
                            Définir comme modèle par défaut
                        </button>
                        {savedTemplateId === selectedTemplate.id && (
                            <p className="text-center text-xs font-medium text-emerald-600">
                                Ce modèle sera sélectionné automatiquement dans la génération QR.
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={handleDisableTemplate}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                            Revenir à QR seul par défaut
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}
