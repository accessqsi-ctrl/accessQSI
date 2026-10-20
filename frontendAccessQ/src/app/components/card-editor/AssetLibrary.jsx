"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { apiFetch, apiUrl } from "../../lib/api";

const KINDS = [
    { id: "logo", label: "Logos" },
    { id: "background", label: "Fonds" },
    { id: "signature", label: "Signatures" },
    { id: "image", label: "Images" }
];
const kindLabel = (id) => KINDS.find(kind => kind.id === id)?.label.replace(/s$/, "") || "Image";

async function readJson(response, fallback) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.message || fallback);
    return data;
}

// Bibliothèque d'images de l'organisation. En mode « pick », un clic sur une image la sélectionne
// (onSelect) ; en mode « manage », on peut seulement renommer, classer, ajouter ou supprimer.
export default function AssetLibrary({ mode = "pick", initialKind = "", onSelect, onClose }) {
    const [assets, setAssets] = useState([]);
    const [maxAssets, setMaxAssets] = useState(200);
    const [filter, setFilter] = useState(initialKind);
    const [uploadKind, setUploadKind] = useState(initialKind || "image");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await readJson(await apiFetch("/card-templates/assets"), "Impossible de charger la bibliothèque.");
            setAssets(data.assets || []);
            setMaxAssets(data.maxAssets || 200);
        } catch (reason) {
            setError(reason.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    const upload = async (file) => {
        if (!file) return;
        setUploading(true);
        setError("");
        try {
            const body = new FormData();
            body.append("file", file);
            body.append("kind", uploadKind);
            body.append("name", file.name.replace(/\.[^.]+$/, "").slice(0, 120));
            const data = await readJson(await apiFetch("/card-templates/assets", { method: "POST", body }), "Import de l’image impossible.");
            setAssets(current => [data.asset, ...current.filter(asset => asset.id !== data.asset.id)]);
            if (mode === "pick") onSelect(data.asset);
        } catch (reason) {
            setError(reason.message);
        } finally {
            setUploading(false);
        }
    };

    const update = async (asset, changes) => {
        setError("");
        try {
            const data = await readJson(await apiFetch(`/card-templates/assets/${asset.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changes)
            }), "Modification impossible.");
            setAssets(current => current.map(item => item.id === asset.id ? data.asset : item));
        } catch (reason) {
            setError(reason.message);
        }
    };

    const remove = async (asset) => {
        setError("");
        try {
            await readJson(await apiFetch(`/card-templates/assets/${asset.id}`, { method: "DELETE" }), "Suppression impossible.");
            setAssets(current => current.filter(item => item.id !== asset.id));
        } catch (reason) {
            setError(reason.message);
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const visible = filter ? assets.filter(asset => asset.kind === filter) : assets;
    const chip = (active) => `rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-5" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="asset-library-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 sm:rounded-3xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div>
                        <h2 id="asset-library-title" className="text-lg font-black text-slate-900 dark:text-white">Bibliothèque d’images</h2>
                        <p className="text-xs text-slate-500">{mode === "pick" ? "Choisissez une image ou importez-en une nouvelle." : "Logos, fonds et signatures réutilisables dans tous vos modèles."} {assets.length}/{maxAssets}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"><X /></button>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
                    <button type="button" className={chip(!filter)} onClick={() => setFilter("")}>Tout</button>
                    {KINDS.map(kind => <button key={kind.id} type="button" className={chip(filter === kind.id)} onClick={() => setFilter(kind.id)}>{kind.label}</button>)}
                    <div className="ml-auto flex items-center gap-2">
                        <select aria-label="Catégorie de l’image importée" value={uploadKind} onChange={(event) => setUploadKind(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">
                            {KINDS.map(kind => <option key={kind.id} value={kind.id}>{kindLabel(kind.id)}</option>)}
                        </select>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Importer
                            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading || assets.length >= maxAssets} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
                        </label>
                    </div>
                </div>

                {error && <p role="alert" className="mx-6 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

                <div className="min-h-64 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>
                    ) : visible.length === 0 ? (
                        <p className="py-16 text-center text-sm text-slate-500">Aucune image{filter ? " dans cette catégorie" : ""}. Importez un logo, un fond ou une signature (JPEG, PNG ou WebP, 2 Mo max.).</p>
                    ) : (
                        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                            {visible.map(asset => (
                                <li key={asset.id} className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                                    <button
                                        type="button"
                                        disabled={mode !== "pick"}
                                        onClick={() => onSelect(asset)}
                                        className="relative block aspect-square w-full bg-[repeating-conic-gradient(#f1f5f9_0_25%,#ffffff_0_50%)] bg-[length:16px_16px] enabled:hover:ring-2 enabled:hover:ring-blue-500 dark:bg-slate-900"
                                        aria-label={mode === "pick" ? `Choisir ${asset.name}` : asset.name}
                                    >
                                        <img src={apiUrl(asset.url)} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
                                        {mode === "pick" && <span className="absolute right-2 top-2 hidden rounded-full bg-blue-600 p-1 text-white group-hover:block"><Check className="h-3.5 w-3.5" /></span>}
                                    </button>
                                    <div className="space-y-1.5 p-2">
                                        <input
                                            aria-label="Nom de l’image"
                                            defaultValue={asset.name}
                                            maxLength={120}
                                            onBlur={(event) => event.target.value.trim() && event.target.value !== asset.name && update(asset, { name: event.target.value })}
                                            className="w-full rounded border border-transparent bg-transparent px-1 text-xs font-semibold text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none dark:text-slate-100"
                                        />
                                        <div className="flex items-center gap-1">
                                            <select aria-label="Catégorie" value={asset.kind} onChange={(event) => update(asset, { kind: event.target.value })} className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                                                {KINDS.map(kind => <option key={kind.id} value={kind.id}>{kindLabel(kind.id)}</option>)}
                                            </select>
                                            {confirmDeleteId === asset.id ? (
                                                <button type="button" onClick={() => remove(asset)} className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">Confirmer</button>
                                            ) : (
                                                <button type="button" onClick={() => setConfirmDeleteId(asset.id)} aria-label={`Supprimer ${asset.name}`} title="Supprimer" className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"><Trash2 className="h-3.5 w-3.5" /></button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
