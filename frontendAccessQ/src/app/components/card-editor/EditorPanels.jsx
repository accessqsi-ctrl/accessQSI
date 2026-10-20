"use client";

import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, ImagePlus, Lock, Trash2, Unlock } from "lucide-react";
import { CARD_FONTS, isBoldWeight, normalizeFontId } from "../../lib/cardFonts.mjs";
import { FIELD_OPTIONS, SCENE_FORMATS, resizeCanvas, scaleSceneToCanvas } from "../../lib/cardScene.mjs";

const inputClass = "w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelClass = "block text-xs font-bold text-slate-600 dark:text-slate-300";
const iconButton = "inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

function NumberField({ label, value, onChange, min, max, step = 1 }) {
    return (
        <label className={labelClass}>
            {label}
            <input
                type="number"
                className={`${inputClass} mt-1`}
                value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
                min={min}
                max={max}
                step={step}
                onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) onChange(next);
                }}
            />
        </label>
    );
}

function ColorField({ label, value, onChange, palette }) {
    return (
        <div className={labelClass}>
            {label}
            <div className="mt-1 flex items-center gap-2">
                <input type="color" value={value || "#000000"} onChange={(event) => onChange(event.target.value)} className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent" aria-label={label} />
                <div className="flex flex-wrap gap-1">
                    {palette.filter(Boolean).map(color => (
                        <button key={color} type="button" title={color} aria-label={`Couleur ${color}`} onClick={() => onChange(color)} className="h-6 w-6 rounded-full border border-slate-300 dark:border-slate-600" style={{ backgroundColor: color }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function PropertiesPanel({ object, template, canDelete, onChange, onDelete, onDuplicate, onReorder, onReplaceImage }) {
    if (!object) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Sélectionnez un élément sur la carte, ou ajoutez-en un avec la barre d’outils.</p>;
    }
    const palette = [template.primaryColor, template.secondaryColor, "#0f172a", "#ffffff", "#64748b", "#d97706"];
    const isText = object.type === "text";
    const isShape = object.type === "rect";
    const isLine = object.type === "line";
    const isImage = object.type === "image" || object.type === "logo";
    const isQr = object.type === "qr";

    return (
        <div className="space-y-4">
            <label className={labelClass}>
                Nom du calque
                <input className={`${inputClass} mt-1`} maxLength={80} value={object.label || ""} onChange={(event) => onChange({ label: event.target.value })} />
            </label>

            {isText && (
                <>
                    <label className={labelClass}>
                        Texte
                        <textarea rows={3} maxLength={240} className={`${inputClass} mt-1 resize-none`} value={object.text || ""} onChange={(event) => onChange({ text: event.target.value })} />
                    </label>
                    <div className="flex flex-wrap gap-1">
                        {FIELD_OPTIONS.map(option => (
                            <button key={option.id} type="button" onClick={() => onChange({ text: `${object.text || ""}{{${option.id}}}` })} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200">
                                + {option.label}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <label className={labelClass}>
                            Police
                            <select className={`${inputClass} mt-1`} value={normalizeFontId(object.fontFamily)} onChange={(event) => onChange({ fontFamily: event.target.value })}>
                                {CARD_FONTS.map(font => <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>{font.label}</option>)}
                            </select>
                        </label>
                        <NumberField label="Taille max." value={object.fontSize} min={6} max={220} onChange={(fontSize) => onChange({ fontSize })} />
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" aria-pressed={isBoldWeight(object.fontWeight)} onClick={() => onChange({ fontWeight: isBoldWeight(object.fontWeight) ? "400" : "700" })} className={`${iconButton} px-3 font-black ${isBoldWeight(object.fontWeight) ? "border-blue-300 bg-blue-50 text-blue-700" : ""}`}>G</button>
                        {[["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]].map(([value, label]) => (
                            <button key={value} type="button" aria-pressed={object.align === value} onClick={() => onChange({ align: value })} className={`${iconButton} px-2.5 text-xs font-bold ${object.align === value ? "border-blue-300 bg-blue-50 text-blue-700" : ""}`}>{label}</button>
                        ))}
                    </div>
                    <ColorField label="Couleur du texte" value={object.fill} palette={palette} onChange={(fill) => onChange({ fill })} />
                </>
            )}

            {isShape && (
                <>
                    <ColorField label="Remplissage" value={object.fill} palette={palette} onChange={(fill) => onChange({ fill })} />
                    <ColorField label="Bordure" value={object.stroke} palette={palette} onChange={(stroke) => onChange({ stroke })} />
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="Épaisseur bordure" value={object.strokeWidth} min={0} max={40} onChange={(strokeWidth) => onChange({ strokeWidth })} />
                        <NumberField label="Arrondi" value={object.cornerRadius} min={0} max={160} onChange={(cornerRadius) => onChange({ cornerRadius })} />
                    </div>
                </>
            )}

            {isLine && (
                <>
                    <ColorField label="Couleur" value={object.stroke} palette={palette} onChange={(stroke) => onChange({ stroke })} />
                    <NumberField label="Épaisseur" value={object.strokeWidth} min={1} max={40} onChange={(strokeWidth) => onChange({ strokeWidth })} />
                </>
            )}

            {isQr && (
                <>
                    <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Gardez le QR assez grand (au moins 200 px) et sur un fond clair pour qu’il reste lisible au scan.</p>
                    <ColorField label="Cadre" value={object.stroke} palette={palette} onChange={(stroke) => onChange({ stroke })} />
                </>
            )}

            {isImage && (
                <button type="button" className={`${iconButton} w-full gap-2 text-xs font-bold`} onClick={onReplaceImage}>
                    <ImagePlus className="h-4 w-4" /> Remplacer l’image
                </button>
            )}

            <div className="grid grid-cols-2 gap-3">
                <NumberField label="X" value={object.x} min={-2400} max={2400} onChange={(x) => onChange({ x })} />
                <NumberField label="Y" value={object.y} min={-2600} max={2600} onChange={(y) => onChange({ y })} />
                <NumberField label="Largeur" value={object.width} min={isLine ? 1 : 10} max={2400} onChange={(width) => onChange(isQr ? { width, height: width } : { width })} />
                <NumberField label="Hauteur" value={object.height} min={isLine ? -2600 : 10} max={2600} onChange={(height) => onChange(isQr ? { width: height, height } : { height })} />
                {!isQr && <NumberField label="Rotation (°)" value={object.rotation} min={-360} max={360} onChange={(rotation) => onChange({ rotation })} />}
                <NumberField label="Opacité (%)" value={Math.round((object.opacity ?? 1) * 100)} min={0} max={100} onChange={(opacity) => onChange({ opacity: Math.min(1, Math.max(0, opacity / 100)) })} />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button type="button" className={iconButton} title="Premier plan" aria-label="Premier plan" onClick={() => onReorder("front")}><ChevronsUp className="h-4 w-4" /></button>
                <button type="button" className={iconButton} title="Avancer" aria-label="Avancer" onClick={() => onReorder("forward")}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className={iconButton} title="Reculer" aria-label="Reculer" onClick={() => onReorder("backward")}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" className={iconButton} title="Arrière-plan" aria-label="Arrière-plan" onClick={() => onReorder("back")}><ChevronsDown className="h-4 w-4" /></button>
                <button type="button" className={iconButton} title={object.locked ? "Déverrouiller" : "Verrouiller"} aria-label={object.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => onChange({ locked: !object.locked })}>{object.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
                <button type="button" className={iconButton} title="Dupliquer (Ctrl+D)" aria-label="Dupliquer" onClick={onDuplicate}><Copy className="h-4 w-4" /></button>
                <button type="button" className={`${iconButton} text-red-600 dark:text-red-300`} disabled={!canDelete} title={canDelete ? "Supprimer" : "La carte doit garder au moins un QR"} aria-label="Supprimer" onClick={onDelete}><Trash2 className="h-4 w-4" /></button>
            </div>
        </div>
    );
}

const TYPE_LABELS = { text: "Texte", rect: "Forme", line: "Ligne", image: "Image", logo: "Logo", qr: "QR", background: "Fond" };

export function LayersPanel({ scene, selectedId, onSelect, onToggle }) {
    const layers = [...scene.objects].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    return (
        <ul className="space-y-1.5">
            {layers.map(object => (
                <li key={object.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${object.id === selectedId ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40" : "border-slate-200 dark:border-slate-800"}`}>
                    <button type="button" onClick={() => onSelect(object.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{object.label || object.id}</span>
                        <span className="text-[11px] text-slate-500">{TYPE_LABELS[object.type] || object.type}</span>
                    </button>
                    <button type="button" className={iconButton} title={object.visible === false ? "Afficher" : "Masquer"} aria-label={object.visible === false ? "Afficher" : "Masquer"} onClick={() => onToggle(object.id, { visible: object.visible === false })}>{object.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                    <button type="button" className={iconButton} title={object.locked ? "Déverrouiller" : "Verrouiller"} aria-label={object.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => onToggle(object.id, { locked: !object.locked })}>{object.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button>
                </li>
            ))}
        </ul>
    );
}

export function CanvasSettingsPanel({ scene, side, template, onChange, onBackgroundChange, onRemoveBack }) {
    const { width, height } = scene.canvas;
    const backgroundColor = side === "back" ? scene.back?.backgroundColor : scene.canvas.backgroundColor;
    const currentFormat = SCENE_FORMATS.find(format => format.width === width && format.height === height)?.id || "custom";
    return (
        <div className="space-y-4">
            <label className={labelClass}>
                Format
                <select
                    className={`${inputClass} mt-1`}
                    value={currentFormat}
                    onChange={(event) => {
                        const format = SCENE_FORMATS.find(item => item.id === event.target.value);
                        if (format) onChange(scaleSceneToCanvas(scene, format.width, format.height));
                    }}
                >
                    {SCENE_FORMATS.map(format => <option key={format.id} value={format.id}>{format.label} · {format.width} × {format.height}</option>)}
                    <option value="custom">Personnalisé</option>
                </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
                <NumberField label="Largeur (px)" value={width} min={240} max={2400} onChange={(value) => onChange(resizeCanvas(scene, value, height))} />
                <NumberField label="Hauteur (px)" value={height} min={240} max={2600} onChange={(value) => onChange(resizeCanvas(scene, width, value))} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Un format prédéfini adapte tout le contenu à la nouvelle carte. Les dimensions saisies à la main ne changent que la carte.</p>
            <ColorField
                label={side === "back" ? "Couleur de fond du verso" : "Couleur de fond du recto"}
                value={backgroundColor}
                palette={[template.primaryColor, template.secondaryColor, "#ffffff", "#f8fafc", "#0f172a"]}
                onChange={onBackgroundChange}
            />
            {scene.back && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Le verso est imprimé sur la page suivant chaque recto : choisissez l’impression recto-verso « bord long » pour les cartes horizontales.</p>
                    <button type="button" onClick={onRemoveBack} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300">
                        <Trash2 className="h-4 w-4" /> Supprimer le verso
                    </button>
                </div>
            )}
        </div>
    );
}
