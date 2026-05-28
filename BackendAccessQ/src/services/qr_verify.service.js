const prisma = require("../prisma/client");

exports.getQrByToken = async (token) => {
    return await prisma.qrCode.findUnique({
        where: { unique_token: token },
        include: {
            event: {
                include: { organization: true }
            }
        }
    });
};

exports.recordScan = async (qrId, scannerId, status) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Créer le journal de scan
        const scan = await tx.scanLog.create({
            data: {
                qr_code_id: qrId,
                scanned_by_id: scannerId,
                status: status
            }
        });

        // 2. Si autorisé, incrémenter le compteur de scans
        if (status === "authorized") {
            await tx.qrCode.update({
                where: { qr_id: qrId },
                data: {
                    scans_count: { increment: 1 }
                }
            });
        }
        return scan;
    });
};


exports.updateQrStatus = async (qrId, newStatus) => {
    return await prisma.qrCode.update({
        where: { qr_id: qrId },
        data: { status: newStatus }
    });
};
