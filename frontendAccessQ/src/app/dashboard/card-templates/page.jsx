"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Copy, Crown, IdCard, Layers, Loader2, Mail, QrCode, Save, ShieldCheck, Sparkles, Ticket, Trash2, Upload } from "lucide-react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { apiFetch } from "../../lib/api";
import LoadingBar from "../../components/LoadingBar";
import { CARD_TEMPLATE_STORAGE_KEY, cardElementLabels, cardTemplates, createDefaultCanvasScene, createDefaultLayoutConfig, defaultVisibleFields, getBaseCardTemplate, normalizeCustomCardTemplate } from "../../lib/cardTemplates";

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

function useCanvasImage(src) {
    const [image, setImage] = useState(null);

    useEffect(() => {
        if (!src) {
            setImage(null);
            return undefined;
        }
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setImage(img);
        img.onerror = () => setImage(null);
        img.src = src;
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [src]);

    return image;
}

function QrPlaceholder({ object, selected, onSelect, onDragEnd, onTransformEnd }) {
    return (
        <Group
            id={object.id}
            x={object.x}
            y={object.y}
            width={object.width}
            height={object.height}
            rotation={object.rotation || 0}
            opacity={object.opacity ?? 1}
            draggable={!object.locked}
            visible={object.visible !== false}
            onClick={onSelect}
            onTap={onSelect}
            onDragEnd={onDragEnd}
            onTransformEnd={onTransformEnd}
        >
            <Rect width={object.width} height={object.height} fill="#ffffff" stroke={selected ? "#2563eb" : object.stroke || "#cbd5e1"} strokeWidth={selected ? 6 : object.strokeWidth || 4} cornerRadius={object.cornerRadius || 18} />
            {Array.from({ length: 25 }).map((_, index) => (
                <Rect
                    key={index}
                    x={18 + (index % 5) * ((object.width - 36) / 5)}
                    y={18 + Math.floor(index / 5) * ((object.height - 36) / 5)}
                    width={Math.max(4, (object.width - 52) / 5)}
                    height={Math.max(4, (object.height - 52) / 5)}
                    fill={index % 2 === 0 || index % 7 === 0 ? "#0f172a" : "#e2e8f0"}
                />
            ))}
        </Group>
    );
}

function CanvasImageObject({ object, selected, fallbackSrc, onSelect, onDragEnd, onTransformEnd }) {
    const image = useCanvasImage(object.src || fallbackSrc);
    const common = {
        id: object.id,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        rotation: object.rotation || 0,
        opacity: object.opacity ?? 1,
        draggable: !object.locked,
        visible: object.visible !== false,
        onClick: onSelect,
        onTap: onSelect,
        onDragEnd,
        onTransformEnd
    };

    if (!image) {
        return (
            <Group {...common}>
                <Rect width={object.width} height={object.height} fill="#f8fafc" stroke={selected ? "#2563eb" : "#cbd5e1"} strokeWidth={selected ? 5 : 2} cornerRadius={object.cornerRadius || 12} />
                <Text text={object.type === "logo" ? "LOGO" : "IMAGE"} width={object.width} height={object.height} align="center" verticalAlign="middle" fill="#64748b" fontStyle="bold" fontSize={Math.min(28, Math.max(12, object.height / 4))} />
            </Group>
        );
    }

    return <KonvaImage image={image} {...common} stroke={selected ? "#2563eb" : undefined} strokeWidth={selected ? 4 : 0} />;
}

function CanvasObject({ object, selected, logoUrl, backgroundImageUrl, onSelect, onChange }) {
    const handleDragEnd = (event) => onChange(object.id, { x: Math.round(event.target.x()), y: Math.round(event.target.y()) });
    const handleTransformEnd = (event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange(object.id, {
            x: Math.round(node.x()),
            y: Math.round(node.y()),
            width: Math.max(5, Math.round((object.width || node.width()) * scaleX)),
            height: Math.max(0, Math.round((object.height || node.height()) * scaleY)),
            rotation: Math.round(node.rotation())
        });
    };
    const common = {
        id: object.id,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        rotation: object.rotation || 0,
        opacity: object.opacity ?? 1,
        draggable: !object.locked,
        visible: object.visible !== false,
        onClick: onSelect,
        onTap: onSelect,
        onDragEnd: handleDragEnd,
        onTransformEnd: handleTransformEnd
    };

    if (object.type === "qr") return <QrPlaceholder object={object} selected={selected} onSelect={onSelect} onDragEnd={handleDragEnd} onTransformEnd={handleTransformEnd} />;
    if (["logo", "image", "background"].includes(object.type)) {
        return <CanvasImageObject object={object} selected={selected} fallbackSrc={object.type === "logo" ? logoUrl : backgroundImageUrl} onSelect={onSelect} onDragEnd={handleDragEnd} onTransformEnd={handleTransformEnd} />;
    }
    if (object.type === "line") {
        return <Line {...common} points={[0, 0, object.width, object.height]} stroke={selected ? "#2563eb" : object.stroke || object.fill || "#0f172a"} strokeWidth={selected ? Math.max(5, object.strokeWidth || 4) : object.strokeWidth || 4} lineCap="round" />;
    }
    if (object.type === "rect") {
        return <Rect {...common} fill={object.fill || "#ffffff"} stroke={selected ? "#2563eb" : object.stroke || "#cbd5e1"} strokeWidth={selected ? Math.max(4, object.strokeWidth || 2) : object.strokeWidth || 0} cornerRadius={object.cornerRadius || 0} />;
    }
    return (
        <Text
            {...common}
            text={object.text || object.label}
            fill={object.fill || "#0f172a"}
            fontFamily={object.fontFamily || "Arial"}
            fontSize={object.fontSize || 32}
            fontStyle={String(object.fontWeight || "700") >= "700" ? "bold" : "normal"}
            align={object.align || "left"}
            verticalAlign="top"
            stroke={selected ? "#2563eb" : undefined}
            strokeWidth={selected ? 0.6 : 0}
        />
    );
}

function KonvaCanvasEditor({ scene, logoUrl, backgroundImageUrl, selectedObjectId, zoom, onSelect, onSceneChange }) {
    const transformerRef = useRef(null);
    const stageRef = useRef(null);
    const canvas = scene?.canvas || { width: 1200, height: 800, backgroundColor: "#ffffff" };
    const objects = [...(scene?.objects || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const stageWidth = Math.min(820, canvas.width * zoom);
    const scale = stageWidth / canvas.width;
    const stageHeight = canvas.height * scale;

    useEffect(() => {
        const transformer = transformerRef.current;
        const stage = stageRef.current;
        if (!transformer || !stage) return;
        const selectedNode = selectedObjectId ? stage.findOne(`#${selectedObjectId}`) : null;
        transformer.nodes(selectedNode ? [selectedNode] : []);
        transformer.getLayer()?.batchDraw();
    }, [selectedObjectId, objects]);

    const updateObject = (objectId, updates) => {
        onSceneChange({
            ...scene,
            objects: (scene.objects || []).map(object => object.id === objectId ? { ...object, ...updates } : object)
        });
    };

    return (
        <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto w-fit rounded-xl bg-white shadow-sm">
                <Stage
                    ref={stageRef}
                    width={stageWidth}
                    height={stageHeight}
                    scaleX={scale}
                    scaleY={scale}
                    onMouseDown={(event) => {
                        if (event.target === event.target.getStage()) onSelect("");
                    }}
                    onTouchStart={(event) => {
                        if (event.target === event.target.getStage()) onSelect("");
                    }}
                >
                    <Layer>
                        <Rect width={canvas.width} height={canvas.height} fill={canvas.backgroundColor || "#ffffff"} />
                        {objects.map(object => (
                            <CanvasObject
                                key={object.id}
                                object={object}
                                selected={selectedObjectId === object.id}
                                logoUrl={logoUrl}
                                backgroundImageUrl={backgroundImageUrl}
                                onSelect={() => !object.locked && onSelect(object.id)}
                                onChange={updateObject}
                            />
                        ))}
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled
                            keepRatio={false}
                            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]}
                            boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
                        />
                    </Layer>
                </Stage>
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
    const [selectedObjectId, setSelectedObjectId] = useState("event");
    const [canvasHistory, setCanvasHistory] = useState([]);
    const [canvasHistoryIndex, setCanvasHistoryIndex] = useState(0);
    const [canvasZoom, setCanvasZoom] = useState(0.52);
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
        canvasScene: template.canvasScene || createDefaultCanvasScene(template.baseTemplateId || template.id),
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
            canvasScene: editor.canvasScene,
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
        const nextEditor = buildEditorFromTemplate(selectedTemplate);
        setEditor(nextEditor);
        setSelectedElementType("event");
        setSelectedObjectId(nextEditor.canvasScene?.objects?.find(object => object.type === "text" && object.field === "event")?.id || nextEditor.canvasScene?.objects?.[0]?.id || "");
        setCanvasHistory([nextEditor.canvasScene]);
        setCanvasHistoryIndex(0);
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

    const handleBackgroundUpload = async (file, mode = "backgroundUrl") => {
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
                const imageUrl = data.backgroundImageUrl;
                if (mode === "imageObject" || mode === "backgroundObject") {
                    const canvas = editor.canvasScene?.canvas || createDefaultCanvasScene(editor.baseTemplateId).canvas;
                    const object = {
                        id: `${mode}-${Date.now()}`,
                        type: mode === "backgroundObject" ? "background" : "image",
                        label: mode === "backgroundObject" ? "Image de fond" : "Image",
                        src: imageUrl,
                        x: mode === "backgroundObject" ? 0 : Math.round(canvas.width * 0.18),
                        y: mode === "backgroundObject" ? 0 : Math.round(canvas.height * 0.18),
                        width: mode === "backgroundObject" ? canvas.width : Math.round(canvas.width * 0.34),
                        height: mode === "backgroundObject" ? canvas.height : Math.round(canvas.height * 0.28),
                        rotation: 0,
                        opacity: mode === "backgroundObject" ? 0.9 : 1,
                        zIndex: mode === "backgroundObject" ? 0 : Math.max(1, ...(editor.canvasScene?.objects || []).map(object => object.zIndex || 0)) + 1,
                        locked: false,
                        visible: true,
                        fill: "#ffffff",
                        stroke: "#cbd5e1",
                        strokeWidth: 0,
                        cornerRadius: 0
                    };
                    commitCanvasScene({
                        ...(editor.canvasScene || createDefaultCanvasScene(editor.baseTemplateId)),
                        objects: mode === "backgroundObject"
                            ? [object, ...(editor.canvasScene?.objects || []).filter(item => item.type !== "background")]
                            : [...(editor.canvasScene?.objects || []), object]
                    });
                    setSelectedObjectId(object.id);
                } else {
                    setEditor(prev => ({ ...prev, backgroundImageUrl: imageUrl }));
                }
                setStatusMessage(mode === "imageObject" ? "Image ajoutée au canvas." : "Image de fond ajoutée.");
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

    const selectedObject = editor?.canvasScene?.objects?.find(object => object.id === selectedObjectId) || null;
    const commitCanvasScene = (nextScene) => {
        setEditor(prev => ({ ...prev, canvasScene: nextScene }));
        setCanvasHistory(prev => {
            const nextHistory = [...prev.slice(0, canvasHistoryIndex + 1), nextScene].slice(-40);
            setCanvasHistoryIndex(nextHistory.length - 1);
            return nextHistory;
        });
    };

    const updateCanvasObject = (objectId, updates) => {
        const scene = editor?.canvasScene || createDefaultCanvasScene(editor.baseTemplateId);
        commitCanvasScene({
            ...scene,
            objects: (scene.objects || []).map(object => object.id === objectId ? { ...object, ...updates } : object)
        });
    };

    const updateCanvasSettings = (updates) => {
        const scene = editor?.canvasScene || createDefaultCanvasScene(editor.baseTemplateId);
        commitCanvasScene({ ...scene, canvas: { ...scene.canvas, ...updates } });
    };

    const undoCanvas = () => {
        if (canvasHistoryIndex <= 0) return;
        const nextIndex = canvasHistoryIndex - 1;
        setCanvasHistoryIndex(nextIndex);
        setEditor(prev => ({ ...prev, canvasScene: canvasHistory[nextIndex] }));
    };

    const redoCanvas = () => {
        if (canvasHistoryIndex >= canvasHistory.length - 1) return;
        const nextIndex = canvasHistoryIndex + 1;
        setCanvasHistoryIndex(nextIndex);
        setEditor(prev => ({ ...prev, canvasScene: canvasHistory[nextIndex] }));
    };

    const resetCanvasScene = () => {
        const scene = createDefaultCanvasScene(editor.baseTemplateId);
        commitCanvasScene(scene);
        setSelectedObjectId(scene.objects?.[0]?.id || "");
    };

    const addCanvasObject = (type) => {
        const scene = editor.canvasScene || createDefaultCanvasScene(editor.baseTemplateId);
        const canvas = scene.canvas;
        const id = `${type}-${Date.now()}`;
        const baseObject = {
            id,
            type,
            label: type === "text" ? "Texte libre" : type.toUpperCase(),
            text: type === "text" ? "Nouveau texte" : "",
            x: Math.round(canvas.width * 0.35),
            y: Math.round(canvas.height * 0.35),
            width: type === "line" ? 280 : ["qr", "logo"].includes(type) ? 220 : 300,
            height: type === "line" ? 0 : ["qr", "logo"].includes(type) ? 220 : type === "rect" ? 120 : 70,
            rotation: 0,
            opacity: 1,
            zIndex: Math.max(1, ...scene.objects.map(object => object.zIndex || 0)) + 1,
            locked: false,
            visible: true,
            fill: type === "rect" ? "#dbeafe" : "#0f172a",
            stroke: type === "line" ? "#2563eb" : "#cbd5e1",
            strokeWidth: type === "line" ? 5 : type === "rect" ? 0 : 4,
            fontSize: 34,
            fontFamily: "Arial",
            fontWeight: "700",
            align: "left",
            cornerRadius: type === "rect" ? 18 : 0
        };
        commitCanvasScene({ ...scene, objects: [...scene.objects, baseObject] });
        setSelectedObjectId(id);
    };

    const duplicateCanvasObject = () => {
        if (!selectedObject) return;
        const scene = editor.canvasScene;
        const copy = {
            ...selectedObject,
            id: `${selectedObject.type}-${Date.now()}`,
            label: `${selectedObject.label || selectedObject.type} copie`,
            x: selectedObject.x + 28,
            y: selectedObject.y + 28,
            zIndex: Math.max(1, ...scene.objects.map(object => object.zIndex || 0)) + 1
        };
        commitCanvasScene({ ...scene, objects: [...scene.objects, copy] });
        setSelectedObjectId(copy.id);
    };

    const deleteCanvasObject = () => {
        if (!selectedObject) return;
        const scene = editor.canvasScene;
        const objects = scene.objects.filter(object => object.id !== selectedObject.id);
        commitCanvasScene({ ...scene, objects });
        setSelectedObjectId(objects[0]?.id || "");
    };

    const moveCanvasLayer = (objectId, direction) => {
        const object = editor.canvasScene?.objects?.find(item => item.id === objectId);
        if (!object) return;
        updateCanvasObject(objectId, { zIndex: Math.max(0, (object.zIndex || 0) + direction) });
    };

    const alignCanvasObject = (mode) => {
        if (!selectedObject) return;
        const canvas = editor.canvasScene.canvas;
        const updates = {
            centerH: { x: Math.round((canvas.width - selectedObject.width) / 2) },
            centerV: { y: Math.round((canvas.height - selectedObject.height) / 2) },
            left: { x: 40 },
            right: { x: Math.max(0, canvas.width - selectedObject.width - 40) }
        }[mode];
        if (updates) updateCanvasObject(selectedObject.id, updates);
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

            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                <section className="grid gap-4">
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

                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Canvas V3</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Édition libre avec déplacement, resize et rotation.</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={undoCanvas} disabled={canvasHistoryIndex <= 0} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Annuler</button>
                                        <button type="button" onClick={redoCanvas} disabled={canvasHistoryIndex >= canvasHistory.length - 1} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Rétablir</button>
                                        <button type="button" onClick={resetCanvasScene} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">Réinitialiser</button>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {["text", "qr", "logo", "rect", "line"].map(type => (
                                                <button key={type} type="button" onClick={() => addCanvasObject(type)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#7A90A4] dark:border-slate-800 dark:text-slate-300">
                                                    + {type}
                                                </button>
                                            ))}
                                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#7A90A4] dark:border-slate-800 dark:text-slate-300">
                                                {uploadingBackground ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                Image
                                                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(event) => handleBackgroundUpload(event.target.files?.[0], "imageObject")} />
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#7A90A4] dark:border-slate-800 dark:text-slate-300">
                                                {uploadingBackground ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                Fond
                                                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(event) => handleBackgroundUpload(event.target.files?.[0], "backgroundObject")} />
                                            </label>
                                            <div className="ml-auto flex items-center gap-2">
                                                <button type="button" onClick={() => setCanvasZoom(value => Math.max(0.25, Number((value - 0.08).toFixed(2))))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">-</button>
                                                <span className="w-12 text-center text-xs font-semibold text-slate-500">{Math.round(canvasZoom * 100)}%</span>
                                                <button type="button" onClick={() => setCanvasZoom(value => Math.min(1.2, Number((value + 0.08).toFixed(2))))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">+</button>
                                            </div>
                                        </div>

                                        <KonvaCanvasEditor
                                            scene={editor.canvasScene}
                                            logoUrl={editor.logoUrl}
                                            backgroundImageUrl={editor.backgroundImageUrl}
                                            selectedObjectId={selectedObjectId}
                                            zoom={canvasZoom}
                                            onSelect={setSelectedObjectId}
                                            onSceneChange={commitCanvasScene}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                                    <Layers className="h-3.5 w-3.5" />
                                                    Calques V3
                                                </h4>
                                                <div className="flex gap-1">
                                                    <button type="button" onClick={duplicateCanvasObject} disabled={!selectedObject} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300">Copier</button>
                                                    <button type="button" onClick={deleteCanvasObject} disabled={!selectedObject} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 disabled:opacity-40 dark:border-red-900/60 dark:text-red-300">Suppr.</button>
                                                </div>
                                            </div>
                                            <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
                                                {[...(editor.canvasScene?.objects || [])].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).map(object => (
                                                    <div key={object.id} className={`rounded-xl border px-3 py-2 text-xs transition-colors ${selectedObjectId === object.id ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200" : "border-slate-200 text-slate-600 hover:border-[#7A90A4] dark:border-slate-800 dark:text-slate-300"}`}>
                                                        <button type="button" onClick={() => setSelectedObjectId(object.id)} className="flex w-full items-center justify-between gap-2 text-left font-semibold">
                                                            <span className="truncate">{object.label || object.type}</span>
                                                            <span className="text-[10px] opacity-70">z{object.zIndex || 0}</span>
                                                        </button>
                                                        <div className="mt-2 grid grid-cols-4 gap-1">
                                                            <button type="button" onClick={() => updateCanvasObject(object.id, { visible: object.visible === false })} className="rounded-lg border border-slate-200 px-1.5 py-1 dark:border-slate-700">{object.visible === false ? "voir" : "hide"}</button>
                                                            <button type="button" onClick={() => updateCanvasObject(object.id, { locked: !object.locked })} className="rounded-lg border border-slate-200 px-1.5 py-1 dark:border-slate-700">{object.locked ? "lock" : "free"}</button>
                                                            <button type="button" onClick={() => moveCanvasLayer(object.id, 1)} className="rounded-lg border border-slate-200 px-1.5 py-1 dark:border-slate-700">+</button>
                                                            <button type="button" onClick={() => moveCanvasLayer(object.id, -1)} className="rounded-lg border border-slate-200 px-1.5 py-1 dark:border-slate-700">-</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {selectedObject && (
                                            <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                                                <h4 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Objet sélectionné</h4>
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    {["x", "y", "width", "height", "rotation", "opacity"].map(key => (
                                                        <label key={key} className="space-y-1">
                                                            <span className="text-[11px] font-semibold text-slate-500">{key}</span>
                                                            <input type="number" step={key === "opacity" ? "0.05" : "1"} value={selectedObject[key] ?? 0} onChange={(event) => updateCanvasObject(selectedObject.id, { [key]: Number(event.target.value) })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                                                        </label>
                                                    ))}
                                                </div>
                                                {selectedObject.type === "text" && (
                                                    <div className="mt-3 space-y-2">
                                                        <input value={selectedObject.text || ""} onChange={(event) => updateCanvasObject(selectedObject.id, { text: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input type="number" value={selectedObject.fontSize || 32} onChange={(event) => updateCanvasObject(selectedObject.id, { fontSize: Number(event.target.value) })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" />
                                                            <input type="color" value={selectedObject.fill || "#0f172a"} onChange={(event) => updateCanvasObject(selectedObject.id, { fill: event.target.value })} className="h-8 w-full rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" />
                                                        </div>
                                                    </div>
                                                )}
                                                {["rect", "line"].includes(selectedObject.type) && (
                                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                                        <input type="color" value={selectedObject.fill || "#0f172a"} onChange={(event) => updateCanvasObject(selectedObject.id, { fill: event.target.value })} className="h-8 w-full rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" />
                                                        <input type="color" value={selectedObject.stroke || "#cbd5e1"} onChange={(event) => updateCanvasObject(selectedObject.id, { stroke: event.target.value })} className="h-8 w-full rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" />
                                                    </div>
                                                )}
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <button type="button" onClick={() => alignCanvasObject("centerH")} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">Centrer H</button>
                                                    <button type="button" onClick={() => alignCanvasObject("centerV")} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">Centrer V</button>
                                                    <button type="button" onClick={() => alignCanvasObject("left")} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">Gauche</button>
                                                    <button type="button" onClick={() => alignCanvasObject("right")} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">Droite</button>
                                                </div>
                                            </div>
                                        )}

                                        <label className="space-y-1.5 block">
                                            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Fond canvas</span>
                                            <input type="color" value={editor.canvasScene?.canvas?.backgroundColor || "#ffffff"} onChange={(event) => updateCanvasSettings({ backgroundColor: event.target.value })} className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" />
                                        </label>
                                    </div>
                                </div>
                            </div>

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
