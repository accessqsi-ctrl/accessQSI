const prisma = require("../prisma/client");
const { evaluateQrScan, applyPeriodLimit } = require("./qr_policy.service");
const { getPeriodBounds } = require("./qr_period.service");

const qrScanInclude = {
    event: {
        include: {
            organization: true,
            EventSchedules: {
                include: { area: true }
            }
        }
    }
};

const buildScanData = (qrId, scannerId, status, location = {}, areaId = null) => {
    const scanData = {
        qr_code_id: qrId,
        scanned_by_id: scannerId,
        status,
        area_id: Number.isInteger(areaId) ? areaId : null
    };

    if (location.latitude !== undefined && location.longitude !== undefined) {
        scanData.location_lat = location.latitude;
        scanData.location_long = location.longitude;
    }
    return scanData;
};

exports.getQrByToken = async (token) => {
    return await prisma.qrCode.findUnique({
        where: { unique_token: token },
        include: qrScanInclude
    });
};

exports.verifyAndRecordScan = async ({
    token,
    scannerId,
    scannerOrgId,
    areaId,
    eventId,
    location = {},
    now = new Date()
}) => {
    return prisma.$transaction(async (tx) => {
        // Le verrou garantit qu'un seul scanner peut consommer la dernière
        // utilisation disponible d'un QR à la fois.
        await tx.$queryRawUnsafe(
            'SELECT "qr_id" FROM "qr_codes" WHERE "unique_token" = $1 FOR UPDATE',
            token
        );

        const qr = await tx.qrCode.findUnique({
            where: { unique_token: token },
            include: qrScanInclude
        });
        let decision = evaluateQrScan(qr, scannerOrgId, now, areaId, eventId);

        // Le comptage s'effectue sous le verrou du QR : deux scans simultanés ne peuvent
        // pas consommer tous les deux le dernier passage de la période.
        if (decision.success && qr.period_limit && qr.period_unit) {
            const bounds = getPeriodBounds(qr.period_unit, now, qr.period_timezone);
            const usedInPeriod = await tx.scanLog.count({
                where: {
                    qr_code_id: qr.qr_id,
                    status: "authorized",
                    scanned_at: { gte: bounds.start, lt: bounds.next }
                }
            });
            decision = applyPeriodLimit(decision, qr, usedInPeriod, bounds);
        }

        if (!decision.shouldRecord) return { qr, decision, scan: null };

        const scan = await tx.scanLog.create({
            data: buildScanData(qr.qr_id, scannerId, decision.scanStatus, location, decision.areaId)
        });

        if (decision.success) {
            const scansCount = qr.scans_count + 1;
            const nextStatus = qr.usage_limit > 0 && scansCount >= qr.usage_limit
                ? "used_up"
                : qr.status;
            await tx.qrCode.update({
                where: { qr_id: qr.qr_id },
                data: {
                    scans_count: scansCount,
                    status: nextStatus
                }
            });
            qr.scans_count = scansCount;
            qr.status = nextStatus;
        }

        // La photo n'est transmise qu'après un accès autorisé, pour la vérification visuelle.
        const photo = decision.success
            ? await tx.qrHolderPhoto.findUnique({
                where: { qr_id: qr.qr_id },
                select: { mime_type: true, data: true }
            })
            : null;

        return {
            qr,
            decision,
            scan,
            holderPhoto: photo ? `data:${photo.mime_type};base64,${Buffer.from(photo.data).toString("base64")}` : null
        };
    });
};
