"use client";

import { apiFetch } from "./api";

const MAX_DIMENSION = 600;
const JPEG_QUALITY = 0.85;

const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
    };
    image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image illisible."));
    };
    image.src = url;
});

// Réduit la photo dans le navigateur (600 px max, JPEG) pour rester bien sous la limite d'1 Mo
// et accélérer l'affichage au scan, même sur une connexion mobile lente.
export async function preparePhotoForUpload(file) {
    if (!file || !file.type?.startsWith("image/")) {
        throw new Error("Choisissez une image (JPEG, PNG ou WebP).");
    }
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("Impossible de préparer la photo.");
    return { blob, previewUrl: URL.createObjectURL(blob) };
}

export async function uploadHolderPhoto(qrId, blob) {
    const formData = new FormData();
    formData.append("photo", blob, "photo.jpg");
    const response = await apiFetch(`/qr/${qrId}/photo`, { method: "PUT", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "Impossible d'enregistrer la photo.");
    return data;
}

export async function deleteHolderPhoto(qrId) {
    const response = await apiFetch(`/qr/${qrId}/photo`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "Impossible de supprimer la photo.");
    return data;
}

// Renvoie une URL locale (blob:) de la photo, à libérer avec URL.revokeObjectURL.
export async function fetchHolderPhotoUrl(qrId) {
    const response = await apiFetch(`/qr/${qrId}/photo`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Impossible de charger la photo.");
    return URL.createObjectURL(await response.blob());
}
