"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";
import { CARD_FONTS, fontFamilyFor, isBoldWeight } from "../../lib/cardFonts.mjs";
import { browserMeasure, layoutText } from "../../lib/cardTextLayout.mjs";
import { resolveTextValue } from "../../lib/cardScene.mjs";

// Motif de QR factice affiché à la place du vrai code dans l'éditeur et les aperçus.
const QR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='white'/%3E%3Cpath d='M10 10h60v60H10zM130 10h60v60h-60zM10 130h60v60H10zM90 90h20v20H90zM130 100h50v20h-50zM100 140h20v50h-20zM140 140h50v50h-50z' fill='black'/%3E%3C/svg%3E";

const imageUrl = (src) => {
    const value = String(src || "").trim();
    if (!value || value.startsWith("data:") || /^https?:\/\//i.test(value)) return value;
    return apiUrl(value.startsWith("/") ? value : `/${value}`);
};

// Recalcule la mise en page des textes une fois les polices de l'éditeur chargées.
export function useCardFontsReady() {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        if (typeof document === "undefined" || !document.fonts) return undefined;
        let active = true;
        const loads = CARD_FONTS.flatMap(font => [
            document.fonts.load(`400 32px ${font.family}`),
            document.fonts.load(`700 32px ${font.family}`)
        ]);
        Promise.allSettled(loads).then(() => active && setVersion(value => value + 1));
        return () => { active = false; };
    }, []);
    return version;
}

const transformFor = (object) => {
    const rotation = Number(object.rotation || 0);
    if (!rotation) return undefined;
    return `rotate(${rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})`;
};

function SceneText({ object, values, template }) {
    const anchor = object.align === "center" ? "middle" : object.align === "right" ? "end" : "start";
    const x = object.align === "center" ? object.x + object.width / 2 : object.align === "right" ? object.x + object.width : object.x;
    const family = fontFamilyFor(object.fontFamily);
    const bold = isBoldWeight(object.fontWeight || "700");
    const layout = layoutText({
        text: resolveTextValue(object, values),
        width: object.width,
        height: Math.abs(object.height),
        fontSize: object.fontSize,
        measure: browserMeasure(family, bold)
    });
    return (
        <text textAnchor={anchor} fontFamily={family} fontSize={layout.fontSize} fontWeight={bold ? 700 : 400} fill={object.fill || template.ink || "#0f172a"}>
            {layout.lines.map((line, index) => (
                <tspan key={index} x={x} y={object.y + layout.fontSize + index * layout.lineHeight}>{line}</tspan>
            ))}
        </text>
    );
}

// Rendu fidèle à renderCanvasScene (backend) : même ordre, mêmes règles d'images et de couleurs.
export function SceneObject({ object, template, values }) {
    const common = { opacity: object.opacity ?? 1, transform: transformFor(object) };
    const primaryImage = template.baseTemplateId === "wedding-invite" ? "" : template.backgroundImageUrl;

    if (object.type === "background") {
        const src = object.src || primaryImage;
        if (src) return <image href={imageUrl(src)} x={object.x} y={object.y} width={object.width} height={object.height} preserveAspectRatio="xMidYMid slice" {...common} />;
        return <rect x={object.x} y={object.y} width={object.width} height={object.height} fill={object.fill} {...common} />;
    }
    if (object.type === "image" || object.type === "logo") {
        const src = object.src || (object.type === "logo" ? template.logoUrl : "");
        if (!src) {
            return <rect x={object.x} y={object.y} width={object.width} height={object.height} fill="#f1f5f9" stroke="#94a3b8" strokeDasharray="12 8" strokeWidth={3} {...common} />;
        }
        return <image href={imageUrl(src)} x={object.x} y={object.y} width={object.width} height={object.height} preserveAspectRatio="xMidYMid meet" {...common} />;
    }
    if (object.type === "qr") {
        return (
            <g {...common}>
                <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={object.cornerRadius || 18} fill="#ffffff" stroke={object.stroke || template.secondaryColor} strokeWidth={object.strokeWidth || 4} />
                <image href={QR_PLACEHOLDER} x={object.x + 16} y={object.y + 16} width={Math.max(20, object.width - 32)} height={Math.max(20, object.height - 32)} preserveAspectRatio="xMidYMid meet" />
            </g>
        );
    }
    if (object.type === "rect") {
        const fill = String(object.fill || "").toLowerCase();
        const usesPrimaryColor = fill === String(template.primaryColor || "").toLowerCase() || String(object.id || "").toLowerCase().includes("accent");
        const clipId = `editor-clip-${String(object.id).replace(/[^a-zA-Z0-9_-]/g, "")}`;
        if (usesPrimaryColor && primaryImage) {
            return (
                <g>
                    <defs><clipPath id={clipId}><rect x={object.x} y={object.y} width={object.width} height={object.height} rx={object.cornerRadius || 0} transform={common.transform} /></clipPath></defs>
                    <image href={imageUrl(primaryImage)} x={object.x} y={object.y} width={object.width} height={object.height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
                    <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={object.cornerRadius || 0} fill="none" stroke={object.stroke || "none"} strokeWidth={object.strokeWidth || 0} {...common} />
                </g>
            );
        }
        return <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={object.cornerRadius || 0} fill={object.fill || "#ffffff"} stroke={object.stroke || "none"} strokeWidth={object.strokeWidth || 0} {...common} />;
    }
    if (object.type === "line") {
        return <line x1={object.x} y1={object.y} x2={object.x + object.width} y2={object.y + object.height} stroke={object.stroke || object.fill || template.primaryColor} strokeWidth={object.strokeWidth || 4} strokeLinecap="round" {...common} />;
    }
    if (object.type === "text") {
        return <g {...common}><SceneText object={object} values={values} template={template} /></g>;
    }
    return null;
}

export const sortedVisibleObjects = (scene) => scene.objects
    .filter(object => object && object.visible !== false)
    .slice()
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

// Aperçu statique d'une scène (vignettes, liste des modèles).
export default function CardSceneRenderer({ scene, template, values, className = "", title }) {
    useCardFontsReady();
    const { width, height, backgroundColor } = scene.canvas;
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={title || "Aperçu de la carte"} preserveAspectRatio="xMidYMid meet">
            <rect width={width} height={height} fill={backgroundColor || "#ffffff"} />
            {sortedVisibleObjects(scene).map(object => <SceneObject key={object.id} object={object} template={template} values={values} />)}
        </svg>
    );
}
