"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ImagePlus, Loader2, Pencil, Plus, Save, Star, Trash2, X } from "lucide-react";
import { apiFetch, apiUrl } from "../../lib/api";

const BASE_TEMPLATES = [
    { id: "event-ticket", name: "Billet événement", format: "Horizontal", accent: "#2563eb", soft: "#dbeafe" },
    { id: "staff-card", name: "Carte staff", format: "Vertical", accent: "#059669", soft: "#d1fae5" },
    { id: "wedding-invite", name: "Invitation mariage", format: "Vertical", accent: "#e11d48", soft: "#ffe4e6" },
    { id: "compact-ticket", name: "Ticket compact", format: "Horizontal", accent: "#1d4ed8", soft: "#dbeafe" }
];

const initialForm = {
    name: "", baseTemplateId: "event-ticket", title: "INVITATION",
    primaryColor: "#2563eb", secondaryColor: "#dbeafe", cardMessageDefault: "Présentez ce QR à l’entrée",
    primaryFillMode: "color", backgroundImageUrl: "",
    qrPosition: "right", visibleFields: { holder: true, event: true, date: true, location: true, level: true, message: true, qr: true }
};

const fields = [
    ["holder", "Titulaire"], ["event", "Événement"], ["date", "Date"], ["location", "Lieu"],
    ["level", "Niveau"], ["message", "Message"], ["qr", "Code QR"]
];
const MODEL_WORKFLOW_ONBOARDING_KEY = "qrAccessModelWorkflowOnboardingDismissed";

async function jsonRequest(path, options) {
    const response = await apiFetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "Une erreur est survenue.");
    return data;
}

function templatePayload(form) {
    const { primaryFillMode, ...payload } = form;
    if (form.baseTemplateId !== "wedding-invite") {
        payload.backgroundImageUrl = primaryFillMode === "image" ? form.backgroundImageUrl : "";
    }
    return payload;
}

function TemplatePreview({ template }) {
    const vertical = BASE_TEMPLATES.find(item => item.id === template.baseTemplateId)?.format === "Vertical";
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewError, setPreviewError] = useState(false);

    useEffect(() => {
        let active = true;
        let objectUrl = "";
        const timer = setTimeout(async () => {
            try {
                const response = await apiFetch("/card-templates/preview", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(template)
                });
                if (!response.ok) throw new Error();
                objectUrl = URL.createObjectURL(await response.blob());
                if (active) { setPreviewUrl(objectUrl); setPreviewError(false); }
            } catch { if (active) setPreviewError(true); }
        }, 250);
        return () => { active = false; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [template]);

    return (
        <div className={`mx-auto overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 ${vertical ? "aspect-[2/3] w-56" : "aspect-[8/3] w-full max-w-lg"}`}>
            {previewUrl ? <img src={previewUrl} alt={`Aperçu fidèle de ${template.name || "la carte"}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center bg-slate-50 text-xs font-semibold text-slate-400">{previewError ? "Aperçu indisponible" : <Loader2 className="h-5 w-5 animate-spin" />}</div>}
        </div>
    );
}

export default function CardTemplatesPage() {
    const [templates, setTemplates] = useState([]);
    const [defaultId, setDefaultId] = useState("");
    const [form, setForm] = useState(initialForm);
    const [editingId, setEditingId] = useState(null);
    const [showEditor, setShowEditor] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [notice, setNotice] = useState(null);
    const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);
    const [uploadingPrimaryImage, setUploadingPrimaryImage] = useState(false);

    useEffect(() => {
        setShowWorkflowGuide(localStorage.getItem(MODEL_WORKFLOW_ONBOARDING_KEY) !== "true");
    }, []);

    const load = useCallback(async () => {
        try {
            const data = await jsonRequest("/card-templates/custom");
            setTemplates(data.templates || []);
            setDefaultId(data.defaultTemplateId || "");
        } catch (error) { setNotice({ type: "error", text: error.message }); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    const preview = useMemo(() => templatePayload(form), [form]);

    const changeBase = (id) => {
        const base = BASE_TEMPLATES.find(item => item.id === id);
        setForm(current => ({
            ...current,
            baseTemplateId: id,
            primaryColor: base.accent,
            secondaryColor: base.soft,
            primaryFillMode: "color",
            backgroundImageUrl: ""
        }));
    };
    const openNew = () => { setEditingId(null); setForm(initialForm); setShowEditor(true); setNotice(null); };
    const openEdit = (template) => {
        setEditingId(template.id);
        setForm({
            ...initialForm,
            ...template,
            primaryFillMode: template.baseTemplateId !== "wedding-invite" && template.backgroundImageUrl ? "image" : "color"
        });
        setShowEditor(true);
        setNotice(null);
    };
    const closeEditor = () => { setShowEditor(false); setEditingId(null); };

    const uploadPrimaryImage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setUploadingPrimaryImage(true);
        setNotice(null);
        try {
            const body = new FormData();
            body.append("background", file);
            const response = await apiFetch("/card-templates/background", { method: "POST", body });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.message || "Import de l’image impossible.");
            setForm(current => ({ ...current, primaryFillMode: "image", backgroundImageUrl: data.backgroundImageUrl }));
        } catch (error) {
            setNotice({ type: "error", text: error.message });
        } finally {
            setUploadingPrimaryImage(false);
        }
    };

    const save = async (event) => {
        event.preventDefault(); setBusy("save"); setNotice(null);
        try {
            await jsonRequest(editingId ? `/card-templates/custom/${editingId}` : "/card-templates/custom", {
                method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(templatePayload(form))
            });
            await load(); closeEditor(); setNotice({ type: "success", text: editingId ? "Modèle mis à jour." : "Modèle créé." });
        } catch (error) { setNotice({ type: "error", text: error.message }); }
        finally { setBusy(""); }
    };

    const action = async (key, path, method, success, body) => {
        setBusy(key); setNotice(null);
        try { await jsonRequest(path, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) }); await load(); setNotice({ type: "success", text: success }); }
        catch (error) { setNotice({ type: "error", text: error.message }); }
        finally { setBusy(""); }
    };

    if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-blue-600" /></div>;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            {/* **************************************** */}
            {/* En-tête et action de création */}
            {/* **************************************** */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div><h1 className="text-2xl font-black text-slate-950 dark:text-white">Modèles de cartes</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Créez une identité visuelle cohérente pour vos billets, badges et invitations.</p></div>
                <button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"><Plus className="h-4 w-4" /> Nouveau modèle</button>
            </div>

            {/* **************************************** */}
            {/* Guide du cycle de vie d'un modèle */}
            {/* **************************************** */}
            {showWorkflowGuide && (
                <section className="relative rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
                    <button type="button" aria-label="Fermer le guide" onClick={() => { localStorage.setItem(MODEL_WORKFLOW_ONBOARDING_KEY, "true"); setShowWorkflowGuide(false); }} className="absolute right-3 top-3 rounded-lg p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-950"><X className="h-4 w-4" /></button>
                    <h2 className="pr-10 font-black text-blue-950 dark:text-blue-100">Le cycle d’un modèle</h2>
                    <div className="mt-4 grid gap-3 text-sm text-blue-900 dark:text-blue-200 md:grid-cols-3">
                        <div className="rounded-xl bg-white/70 p-4 dark:bg-slate-950/40"><strong>1. Créez un modèle</strong><p className="mt-1 text-xs leading-5 opacity-80">Personnalisez-le et contrôlez son apparence dans l’aperçu.</p></div>
                        <div className="rounded-xl bg-white/70 p-4 dark:bg-slate-950/40"><strong>2. Publiez-le</strong><p className="mt-1 text-xs leading-5 opacity-80">Il devient disponible lors de la génération de nouveaux QR.</p></div>
                        <div className="rounded-xl bg-white/70 p-4 dark:bg-slate-950/40"><strong>3. Modifiez-le directement</strong><p className="mt-1 text-xs leading-5 opacity-80">Vous pouvez enregistrer vos changements sans créer de copie.</p></div>
                    </div>
                </section>
            )}

            {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{notice.text}</div>}

            {/* **************************************** */}
            {/* Grille des modèles enregistrés */}
            {/* **************************************** */}
            {templates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-950"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Plus /></div><h2 className="font-black text-slate-900 dark:text-white">Aucun modèle personnalisé</h2><p className="mt-2 text-sm text-slate-500">Créez votre premier modèle à partir de l’un des 4 formats disponibles.</p><button onClick={openNew} className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Créer un modèle</button></div>
            ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{templates.map(template => (
                    <article key={template.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="bg-slate-100 p-5 dark:bg-slate-900"><TemplatePreview template={template} /></div>
                        <div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-black text-slate-900 dark:text-white">{template.name}</h2><p className="mt-1 text-xs text-slate-500">{BASE_TEMPLATES.find(item => item.id === template.baseTemplateId)?.name} · {template.status === "DRAFT" ? "Brouillon" : template.status === "ARCHIVED" ? "Archivé" : "Publié"}</p></div>{defaultId === template.templateId && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700"><Star className="h-3 w-3 fill-current" /> PAR DÉFAUT</span>}</div>
                            <div className="mt-5 grid grid-cols-5 gap-2">
                                <button title="Modifier" disabled={!!busy} onClick={() => openEdit(template)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="mx-auto h-4 w-4" /></button>
                                <button title="Dupliquer" disabled={!!busy} onClick={() => action(`copy-${template.id}`, `/card-templates/custom/${template.id}/duplicate`, "POST", "Modèle dupliqué.")} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Copy className="mx-auto h-4 w-4" /></button>
                                <button title={template.status === "PUBLISHED" ? "Archiver" : template.status === "ARCHIVED" ? "Republier" : "Publier"} disabled={!!busy} onClick={() => action(`status-${template.id}`, `/card-templates/custom/${template.id}/status`, "PUT", template.status === "PUBLISHED" ? "Modèle archivé." : "Modèle publié.", { status: template.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED" })} className="rounded-lg border border-slate-200 p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-35">{template.status === "PUBLISHED" ? <X className="mx-auto h-4 w-4" /> : <Check className="mx-auto h-4 w-4" />}</button>
                                <button title="Définir par défaut" disabled={!!busy || defaultId === template.templateId || template.status !== "PUBLISHED"} onClick={() => action(`default-${template.id}`, `/card-templates/custom/${template.id}/default`, "PUT", "Modèle défini par défaut.")} className="rounded-lg border border-slate-200 p-2 text-amber-600 hover:bg-amber-50 disabled:opacity-40"><Star className="mx-auto h-4 w-4" /></button>
                                <button title="Supprimer" disabled={!!busy} onClick={() => setTemplateToDelete(template)} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"><Trash2 className="mx-auto h-4 w-4" /></button>
                            </div>
                        </div>
                    </article>
                ))}</div>
            )}

            {/* **************************************** */}
            {/* Confirmation de suppression d'un modèle */}
            {/* **************************************** */}
            {templateToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="delete-template-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300"><Trash2 className="h-5 w-5" /></div>
                        <h2 id="delete-template-title" className="mt-4 text-center text-lg font-black text-slate-950 dark:text-white">Confirmer la suppression</h2>
                        <p className="mt-2 text-center text-sm leading-6 text-slate-600 dark:text-slate-300">Voulez-vous vraiment supprimer le modèle « {templateToDelete.name} » ?</p>
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button type="button" disabled={!!busy} onClick={() => setTemplateToDelete(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">Non, annuler</button>
                            <button type="button" disabled={!!busy} onClick={async () => { const template = templateToDelete; setTemplateToDelete(null); await action(`delete-${template.id}`, `/card-templates/custom/${template.id}`, "DELETE", "Modèle supprimé."); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"><Trash2 className="h-4 w-4" />Oui, supprimer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* **************************************** */}
            {/* Formulaire de création ou de modification avec aperçu */}
            {/* **************************************** */}
            {showEditor && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div role="dialog" aria-modal="true" className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 sm:rounded-3xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"><div><h2 className="text-lg font-black dark:text-white">{editingId ? "Modifier le modèle" : "Nouveau modèle"}</h2><p className="text-xs text-slate-500">Les modifications apparaissent immédiatement dans l’aperçu.</p></div><button onClick={closeEditor} aria-label="Fermer" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X /></button></div>
                <form onSubmit={save} className="grid gap-8 p-6 lg:grid-cols-[1fr_1.1fr]"><div className="space-y-5">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Nom du modèle<input required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex. Pass VIP entreprise" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900" /></label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Format de base<select value={form.baseTemplateId} onChange={e => changeBase(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900">{BASE_TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.name} · {item.format}</option>)}</select></label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Titre<input value={form.title} maxLength={80} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900" /></label>
                    {form.baseTemplateId === "wedding-invite" ? (
                        <div className="grid grid-cols-2 gap-4">{[["primaryColor", "Couleur principale"], ["secondaryColor", "Couleur secondaire"]].map(([key, label]) => <label key={key} className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}<span className="mt-2 flex rounded-xl border border-slate-200 bg-slate-50 p-2"><input type="color" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="h-8 w-10 cursor-pointer border-0 bg-transparent" /><input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} pattern="#[0-9a-fA-F]{6}" className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none" /></span></label>)}</div>
                    ) : (
                        <div className="space-y-4">
                            <fieldset>
                                <legend className="text-sm font-bold text-slate-700 dark:text-slate-200">Remplissage principal</legend>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <label className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-bold ${form.primaryFillMode === "color" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
                                        <input type="radio" name="primaryFillMode" value="color" checked={form.primaryFillMode === "color"} onChange={() => setForm(current => ({ ...current, primaryFillMode: "color" }))} className="sr-only" />
                                        Utiliser la couleur
                                    </label>
                                    <label className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-bold ${form.primaryFillMode === "image" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
                                        <input type="radio" name="primaryFillMode" value="image" checked={form.primaryFillMode === "image"} onChange={() => setForm(current => ({ ...current, primaryFillMode: "image" }))} className="sr-only" />
                                        Utiliser une image
                                    </label>
                                </div>
                            </fieldset>
                            {form.primaryFillMode === "color" ? (
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Couleur principale<span className="mt-2 flex rounded-xl border border-slate-200 bg-slate-50 p-2"><input type="color" value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="h-8 w-10 cursor-pointer border-0 bg-transparent" /><input value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} pattern="#[0-9a-fA-F]{6}" className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none" /></span></label>
                            ) : (
                                <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/15">
                                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">L’image sera recadrée et centrée dans les zones de couleur principale, sans déformation.</p>
                                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
                                        {uploadingPrimaryImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                                        {uploadingPrimaryImage ? "Import en cours..." : form.backgroundImageUrl ? "Changer l’image" : "Uploader une image"}
                                        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingPrimaryImage} onChange={uploadPrimaryImage} className="hidden" />
                                    </label>
                                    {form.backgroundImageUrl && <div className="mt-3 flex items-center gap-3"><img src={apiUrl(form.backgroundImageUrl)} alt="Remplissage principal" className="h-20 w-28 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700" /><button type="button" onClick={() => setForm(current => ({ ...current, backgroundImageUrl: "" }))} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Retirer</button></div>}
                                </div>
                            )}
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Couleur secondaire<span className="mt-2 flex rounded-xl border border-slate-200 bg-slate-50 p-2"><input type="color" value={form.secondaryColor} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} className="h-8 w-10 cursor-pointer border-0 bg-transparent" /><input value={form.secondaryColor} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} pattern="#[0-9a-fA-F]{6}" className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none" /></span></label>
                        </div>
                    )}
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Position du QR<select value={form.qrPosition} onChange={e => setForm({ ...form, qrPosition: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"><option value="right">À droite</option><option value="left">À gauche</option><option value="center">Au centre</option></select></label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Message par défaut<textarea rows="2" maxLength={160} value={form.cardMessageDefault} onChange={e => setForm({ ...form, cardMessageDefault: e.target.value })} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900" /></label>
                    <fieldset><legend className="text-sm font-bold text-slate-700 dark:text-slate-200">Informations affichées</legend><div className="mt-2 grid grid-cols-2 gap-2">{fields.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"><input type="checkbox" checked={form.visibleFields[key]} onChange={e => setForm({ ...form, visibleFields: { ...form.visibleFields, [key]: e.target.checked } })} className="accent-blue-600" />{label}</label>)}</div></fieldset>
                </div><div className="flex min-h-96 flex-col justify-center rounded-2xl bg-slate-100 p-6 dark:bg-slate-900"><span className="mb-5 text-center text-xs font-black uppercase tracking-widest text-slate-400">Aperçu</span><TemplatePreview template={preview} /></div>
                <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 lg:col-span-2 dark:border-slate-800"><button type="button" onClick={closeEditor} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Annuler</button><button disabled={busy === "save"} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}{editingId ? "Enregistrer" : "Créer le modèle"}</button></div>
                </form></div></div>}
        </div>
    );
}
