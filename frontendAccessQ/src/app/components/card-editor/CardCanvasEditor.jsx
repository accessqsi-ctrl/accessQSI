"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grid3x3, ImagePlus, Minus, QrCode, Redo2, Square, Type, Undo2, Variable } from "lucide-react";
import { SceneObject, sortedVisibleObjects, useCardFontsReady } from "./CardSceneRenderer";
import { CanvasSettingsPanel, LayersPanel, PropertiesPanel } from "./EditorPanels";
import {
    FIELD_OPTIONS,
    addBackSide,
    addObject,
    canAddObject,
    canDeleteObject,
    createObject,
    deleteObject,
    duplicateObject,
    moveObjectTo,
    removeBackSide,
    reorderObject,
    resizeObjectTo,
    sampleValues,
    sideView,
    withSide
} from "../../lib/cardScene.mjs";

const HISTORY_LIMIT = 60;
const GRID_SIZE = 10;

const isTypingTarget = (target) => {
    const tag = target?.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
};

// Éditeur visuel d'une scène de carte (recto et verso facultatif). La scène complète est la source
// de vérité : chaque modification validée (fin d'un glisser, champ modifié) est remontée via
// onChange et ajoutée à l'historique. L'éditeur travaille sur la « vue » du côté affiché.
export default function CardCanvasEditor({ initialScene, template, onChange, onPickImage }) {
    const [scene, setScene] = useState(initialScene);
    const [side, setSide] = useState("front");
    const [selectedId, setSelectedId] = useState(null);
    const [tab, setTab] = useState("properties");
    const [snap, setSnap] = useState(true);
    const [error, setError] = useState("");
    const history = useRef({ past: [], future: [] });
    const [, setHistoryVersion] = useState(0);
    const svgRef = useRef(null);
    const dragRef = useRef(null);
    const sceneRef = useRef(scene);
    useCardFontsReady();

    useEffect(() => { sceneRef.current = scene; }, [scene]);

    const values = useMemo(() => sampleValues(template), [template]);
    const view = sideView(scene, side);
    const selected = view.objects.find(object => object.id === selectedId) || null;
    const grid = snap ? GRID_SIZE : 0;
    const requireQr = side === "front";
    const hasQr = view.objects.some(object => object.type === "qr");
    const currentView = () => sideView(sceneRef.current, side);

    // Valide une nouvelle scène complète : historique, état local et remontée au formulaire.
    const commit = useCallback((next, previous = sceneRef.current) => {
        if (next === previous) return;
        history.current.past = [...history.current.past, previous].slice(-HISTORY_LIMIT);
        history.current.future = [];
        setHistoryVersion(version => version + 1);
        sceneRef.current = next;
        setScene(next);
        onChange(next);
    }, [onChange]);

    // Une scène modifiée hors de l'éditeur (couleurs du modèle) entre dans l'historique comme une édition.
    useEffect(() => {
        if (initialScene && initialScene !== sceneRef.current) commit(initialScene);
    }, [commit, initialScene]);

    // Valide une modification du côté affiché.
    const commitView = useCallback((nextView, previous = sceneRef.current) => {
        commit(withSide(sceneRef.current, side, nextView), previous);
    }, [commit, side]);

    const restore = useCallback((target) => {
        sceneRef.current = target;
        setScene(target);
        onChange(target);
        if (side === "back" && !target.back) setSide("front");
    }, [onChange, side]);

    const undo = useCallback(() => {
        const { past, future } = history.current;
        if (!past.length) return;
        const previous = past[past.length - 1];
        history.current = { past: past.slice(0, -1), future: [sceneRef.current, ...future] };
        setHistoryVersion(version => version + 1);
        restore(previous);
    }, [restore]);

    const redo = useCallback(() => {
        const { past, future } = history.current;
        if (!future.length) return;
        const next = future[0];
        history.current = { past: [...past, sceneRef.current], future: future.slice(1) };
        setHistoryVersion(version => version + 1);
        restore(next);
    }, [restore]);

    const updateSelected = useCallback((changes) => {
        if (!selectedId) return;
        const current = sideView(sceneRef.current, side);
        commitView({ ...current, objects: current.objects.map(object => object.id === selectedId ? { ...object, ...changes } : object) });
    }, [commitView, selectedId, side]);

    const add = (type, overrides = {}) => {
        const current = currentView();
        if (!canAddObject(current)) {
            setError("Chaque côté de la carte peut contenir au maximum 80 éléments.");
            return;
        }
        const object = createObject(current, type, overrides);
        commitView(addObject(current, object));
        setSelectedId(object.id);
        setTab("properties");
        setError("");
    };

    const addField = (fieldId) => {
        if (!fieldId) return;
        const option = FIELD_OPTIONS.find(item => item.id === fieldId);
        add("text", { field: fieldId, text: `{{${fieldId}}}`, label: option?.label || "Champ" });
    };

    const addImage = async () => {
        setError("");
        const asset = await onPickImage();
        if (asset?.url) add("image", { src: asset.url, label: String(asset.name || "Image").slice(0, 80) });
    };

    const removeSelected = useCallback(() => {
        if (!selectedId) return;
        const current = sideView(sceneRef.current, side);
        if (!canDeleteObject(current, selectedId, { requireQr })) {
            setError("Le QR code est indispensable au contrôle d’accès : le recto doit en garder au moins un.");
            return;
        }
        commitView(deleteObject(current, selectedId, { requireQr }));
        setSelectedId(null);
        setError("");
    }, [commitView, requireQr, selectedId, side]);

    const duplicateSelected = useCallback(() => {
        if (!selectedId) return;
        const result = duplicateObject(sideView(sceneRef.current, side), selectedId);
        if (!result.id) return;
        commitView(result.scene);
        setSelectedId(result.id);
    }, [commitView, selectedId, side]);

    const switchSide = (next) => {
        if (next === "back" && !sceneRef.current.back) commit(addBackSide(sceneRef.current));
        setSide(next);
        setSelectedId(null);
        setError("");
    };

    const removeBack = () => {
        commit(removeBackSide(sceneRef.current));
        setSide("front");
        setSelectedId(null);
    };

    // Coordonnées du pointeur dans le repère de la carte, quel que soit le zoom d'affichage.
    const toCanvasPoint = (event) => {
        const svg = svgRef.current;
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(svg.getScreenCTM().inverse());
    };

    const startDrag = (event, object, mode) => {
        event.stopPropagation();
        setSelectedId(object.id);
        if (object.locked) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const start = toCanvasPoint(event);
        dragRef.current = { mode, id: object.id, start, origin: { ...object }, before: sceneRef.current, moved: false };
    };

    const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const point = toCanvasPoint(event);
        const dx = point.x - drag.start.x;
        const dy = point.y - drag.start.y;
        if (!drag.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        drag.moved = true;
        const current = sideView(sceneRef.current, side);
        const changes = drag.mode === "move"
            ? moveObjectTo(drag.origin, drag.origin.x + dx, drag.origin.y + dy, current, grid)
            : resizeObjectTo(drag.origin, drag.origin.width + dx, drag.origin.height + dy, grid);
        const next = withSide(sceneRef.current, side, {
            ...current,
            objects: current.objects.map(object => object.id === drag.id ? { ...object, ...changes } : object)
        });
        sceneRef.current = next;
        setScene(next);
    };

    const endDrag = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (drag?.moved) commit(sceneRef.current, drag.before);
    };

    useEffect(() => {
        const onKeyDown = (event) => {
            if (isTypingTarget(event.target)) return;
            const modifier = event.ctrlKey || event.metaKey;
            if (modifier && event.key.toLowerCase() === "z") {
                event.preventDefault();
                if (event.shiftKey) redo(); else undo();
                return;
            }
            if (modifier && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
            if (!selectedId) return;
            if (modifier && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
            if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); return; }
            if (event.key === "Escape") { setSelectedId(null); return; }
            const step = event.shiftKey ? 10 : 1;
            const offsets = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            const offset = offsets[event.key];
            const current = sideView(sceneRef.current, side);
            const object = current.objects.find(item => item.id === selectedId);
            if (offset && object && !object.locked) {
                event.preventDefault();
                updateSelected(moveObjectTo(object, object.x + offset[0], object.y + offset[1], current, 0));
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [duplicateSelected, redo, removeSelected, selectedId, side, undo, updateSelected]);

    const { width, height, backgroundColor } = view.canvas;
    const handleSize = Math.max(14, Math.round(Math.max(width, height) / 70));
    const toolButton = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
    const sideButton = (active) => `px-3 py-1.5 text-xs font-bold ${active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`;

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-3">
                {/* Barre d'outils */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700" role="group" aria-label="Côté de la carte">
                        <button type="button" aria-pressed={side === "front"} className={sideButton(side === "front")} onClick={() => switchSide("front")}>Recto</button>
                        <button type="button" aria-pressed={side === "back"} className={sideButton(side === "back")} onClick={() => switchSide("back")}>{scene.back ? "Verso" : "+ Verso"}</button>
                    </div>
                    <button type="button" className={toolButton} onClick={() => add("text")}><Type className="h-4 w-4" /> Texte</button>
                    <label className={`${toolButton} cursor-pointer`}>
                        <Variable className="h-4 w-4" />
                        <select aria-label="Ajouter un champ variable" value="" onChange={(event) => addField(event.target.value)} className="bg-transparent text-xs font-bold outline-none">
                            <option value="">Champ…</option>
                            {FIELD_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                    </label>
                    <button type="button" className={toolButton} onClick={addImage}><ImagePlus className="h-4 w-4" /> Image / logo</button>
                    <button type="button" className={toolButton} onClick={() => add("rect", { fill: template.secondaryColor || "#dbeafe", stroke: template.primaryColor || "#2563eb" })}><Square className="h-4 w-4" /> Forme</button>
                    <button type="button" className={toolButton} onClick={() => add("line", { stroke: template.primaryColor || "#2563eb" })}><Minus className="h-4 w-4" /> Ligne</button>
                    <button type="button" className={toolButton} disabled={hasQr} title={hasQr ? "Ce côté contient déjà un QR" : "Ajouter le QR"} onClick={() => add("qr", { stroke: template.secondaryColor || "#dbeafe" })}><QrCode className="h-4 w-4" /> QR</button>
                    <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
                    <button type="button" className={toolButton} disabled={!history.current.past.length} onClick={undo} title="Annuler (Ctrl+Z)" aria-label="Annuler"><Undo2 className="h-4 w-4" /></button>
                    <button type="button" className={toolButton} disabled={!history.current.future.length} onClick={redo} title="Rétablir (Ctrl+Maj+Z)" aria-label="Rétablir"><Redo2 className="h-4 w-4" /></button>
                    <button type="button" className={`${toolButton} ${snap ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200" : ""}`} onClick={() => setSnap(value => !value)} aria-pressed={snap} title="Aligner sur une grille de 10 px"><Grid3x3 className="h-4 w-4" /> Grille</button>
                </div>

                {/* Zone de travail */}
                <div className="overflow-auto rounded-2xl bg-slate-200/70 p-4 dark:bg-slate-900">
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${width} ${height}`}
                        className="mx-auto block touch-none select-none shadow-xl"
                        // La zone épouse le format : une carte verticale n'est pas étirée sur toute la largeur.
                        style={{ aspectRatio: `${width} / ${height}`, width: "100%", maxHeight: "60vh", maxWidth: `calc(60vh * ${width / height})` }}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onPointerDown={() => setSelectedId(null)}
                        role="application"
                        aria-label={`Zone d’édition de la carte (${side === "back" ? "verso" : "recto"})`}
                    >
                        <rect width={width} height={height} fill={backgroundColor || "#ffffff"} />
                        {snap && (
                            <g pointerEvents="none" opacity="0.18">
                                {Array.from({ length: Math.floor(width / 100) }, (_, index) => <line key={`v${index}`} x1={(index + 1) * 100} y1={0} x2={(index + 1) * 100} y2={height} stroke="#2563eb" strokeWidth={1} />)}
                                {Array.from({ length: Math.floor(height / 100) }, (_, index) => <line key={`h${index}`} x1={0} y1={(index + 1) * 100} x2={width} y2={(index + 1) * 100} stroke="#2563eb" strokeWidth={1} />)}
                            </g>
                        )}
                        {sortedVisibleObjects(view).map(object => (
                            <g key={object.id} onPointerDown={(event) => startDrag(event, object, "move")} style={{ cursor: object.locked ? "default" : "move" }}>
                                <SceneObject object={object} template={template} values={values} />
                                {/* Zone de saisie élargie : les lignes et textes fins restent faciles à attraper */}
                                <rect
                                    x={Math.min(object.x, object.x + object.width)}
                                    y={Math.min(object.y, object.y + object.height) - (object.type === "line" ? 12 : 0)}
                                    width={Math.max(Math.abs(object.width), 12)}
                                    height={Math.max(Math.abs(object.height), object.type === "line" ? 24 : 12)}
                                    fill="transparent"
                                    transform={object.rotation ? `rotate(${object.rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})` : undefined}
                                />
                            </g>
                        ))}
                        {selected && selected.visible !== false && (
                            <g transform={selected.rotation ? `rotate(${selected.rotation} ${selected.x + selected.width / 2} ${selected.y + selected.height / 2})` : undefined} pointerEvents="none">
                                <rect
                                    x={Math.min(selected.x, selected.x + selected.width) - 4}
                                    y={Math.min(selected.y, selected.y + selected.height) - 4}
                                    width={Math.abs(selected.width) + 8}
                                    height={Math.abs(selected.height) + 8}
                                    fill="none"
                                    stroke={selected.locked ? "#f59e0b" : "#2563eb"}
                                    strokeWidth={Math.max(2, handleSize / 5)}
                                    strokeDasharray={`${handleSize} ${handleSize / 2}`}
                                />
                                {!selected.locked && (
                                    <rect
                                        x={selected.x + selected.width - handleSize / 2}
                                        y={selected.y + selected.height - handleSize / 2}
                                        width={handleSize}
                                        height={handleSize}
                                        rx={handleSize / 4}
                                        fill="#ffffff"
                                        stroke="#2563eb"
                                        strokeWidth={Math.max(2, handleSize / 6)}
                                        pointerEvents="all"
                                        style={{ cursor: "nwse-resize" }}
                                        onPointerDown={(event) => startDrag(event, selected, "resize")}
                                        aria-label="Redimensionner"
                                    />
                                )}
                            </g>
                        )}
                    </svg>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Glissez les éléments pour les déplacer, la poignée pour les redimensionner. Flèches : déplacer (Maj = 10 px) · Suppr : supprimer · Ctrl+D : dupliquer · Ctrl+Z : annuler.
                    Les textes passent à la ligne et se réduisent automatiquement pour tenir dans leur cadre.
                    {scene.back && " Le verso est imprimé sur la page suivant chaque recto du PDF."}
                </p>
                {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
            </div>

            {/* Panneaux latéraux */}
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="flex border-b border-slate-200 text-xs font-bold dark:border-slate-800" role="tablist">
                    {[["properties", "Élément"], ["layers", "Calques"], ["canvas", "Carte"]].map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 px-3 py-2.5 ${tab === id ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-300" : "text-slate-500"}`}>{label}</button>
                    ))}
                </div>
                <div className="max-h-[65vh] overflow-y-auto p-4">
                    {tab === "properties" && (
                        <PropertiesPanel
                            object={selected}
                            template={template}
                            canDelete={selected ? canDeleteObject(view, selected.id, { requireQr }) : false}
                            onChange={updateSelected}
                            onDelete={removeSelected}
                            onDuplicate={duplicateSelected}
                            onReorder={(direction) => commitView(reorderObject(currentView(), selected.id, direction))}
                            onReplaceImage={async () => {
                                const asset = await onPickImage();
                                if (asset?.url) updateSelected({ src: asset.url });
                            }}
                        />
                    )}
                    {tab === "layers" && (
                        <LayersPanel
                            scene={view}
                            selectedId={selectedId}
                            onSelect={(id) => { setSelectedId(id); setTab("properties"); }}
                            onToggle={(id, changes) => {
                                const current = currentView();
                                commitView({ ...current, objects: current.objects.map(object => object.id === id ? { ...object, ...changes } : object) });
                            }}
                        />
                    )}
                    {tab === "canvas" && (
                        <CanvasSettingsPanel
                            scene={scene}
                            side={side}
                            template={template}
                            onChange={commit}
                            onBackgroundChange={(color) => {
                                const current = currentView();
                                commitView({ ...current, canvas: { ...current.canvas, backgroundColor: color } });
                            }}
                            onRemoveBack={removeBack}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
