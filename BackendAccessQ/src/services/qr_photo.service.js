// Photo d'identification du titulaire d'un QR. Elle est conservée en base (jamais dans le
// stockage public) et n'est servie qu'aux membres authentifiés de l'organisation.
const prisma = require("../prisma/client");
const { detectImageType } = require("../utils/imageType");

const MAX_PHOTO_BYTES = 1024 * 1024;

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
