// Photo d'identification du titulaire d'un QR. Elle est conservée en base (jamais dans le
// stockage public) et n'est servie qu'aux membres authentifiés de l'organisation.
const prisma = require("../prisma/client");

const MAX_PHOTO_BYTES = 1024 * 1024;

// Le type est déduit des octets du fichier, jamais du nom ou du Content-Type envoyé.
const detectImageType = (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    return null;
};

const savePhoto = (qrId, buffer, mimeType) => prisma.qrHolderPhoto.upsert({
    where: { qr_id: qrId },
    create: { qr_id: qrId, mime_type: mimeType, data: buffer },
    update: { mime_type: mimeType, data: buffer },
    select: { qr_id: true, updated_at: true }
});

const deletePhoto = (qrId) => prisma.qrHolderPhoto.deleteMany({ where: { qr_id: qrId } });

const getPhoto = (qrId) => prisma.qrHolderPhoto.findUnique({
    where: { qr_id: qrId },
    select: { mime_type: true, data: true, updated_at: true }
});

const getPhotoDataUrl = async (qrId) => {
    const photo = await getPhoto(qrId);
    if (!photo) return null;
    return `data:${photo.mime_type};base64,${Buffer.from(photo.data).toString("base64")}`;
};

module.exports = {
    MAX_PHOTO_BYTES,
    deletePhoto,
    detectImageType,
    getPhoto,
    getPhotoDataUrl,
    savePhoto
};
