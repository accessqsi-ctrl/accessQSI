const prisma = require("../prisma/client");
const { createObjectCsvWriter } = require("csv-writer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { formatUsageLimit, getEffectiveQrStatus } = require("../services/qr_status.service");
const { resolveTimeZone } = require("../services/qr_period.service");

const QR_STATUS_LABELS = { active: "ACTIF", used_up: "ÉPUISÉ", expired: "EXPIRÉ", revoked: "RÉVOQUÉ" };
const formatQrStatus = (qr) => {
    const status = getEffectiveQrStatus(qr);
    return QR_STATUS_LABELS[status] || status;
};

// Dates du rapport en français, dans le fuseau de l'administrateur (?tz= envoyé par le navigateur)
// et non dans celui du serveur.
const reportClock = (timeZone) => {
    const zone = resolveTimeZone(timeZone);
    const date = new Intl.DateTimeFormat("fr-FR", { timeZone: zone, dateStyle: "short" });
    const time = new Intl.DateTimeFormat("fr-FR", { timeZone: zone, timeStyle: "medium" });
    const dateTime = new Intl.DateTimeFormat("fr-FR", { timeZone: zone, dateStyle: "short", timeStyle: "short" });
    return {
        zone,
        date: (value) => date.format(new Date(value)),
        time: (value) => time.format(new Date(value)),
        dateTime: (value) => dateTime.format(new Date(value))
    };
};

// Excel en français attend le point-virgule et ne reconnaît l'UTF-8 (accents) qu'avec un BOM.
const CSV_DELIMITER = ";";

const formatScanStatus = (status) => {
    const labels = {
        authorized: "AUTORISÉ",
        denied_expired: "REFUSÉ - EXPIRÉ",
        denied_revoked: "REFUSÉ - RÉVOQUÉ",
        denied_limit_reached: "REFUSÉ - LIMITE ATTEINTE",
        denied_event_inactive: "REFUSÉ - ÉVÉNEMENT INACTIF",
        denied_event_not_selected: "REFUSÉ - AUTRE ÉVÉNEMENT",
        denied_area_not_allowed: "REFUSÉ - ZONE NON AUTORISÉE",
        denied_insufficient_level: "REFUSÉ - NIVEAU INSUFFISANT",
        denied_period_limit: "REFUSÉ - LIMITE DE LA PÉRIODE"
    };
    return labels[status] || status || "-";
};

const formatLocationValue = (value) => {
    if (value === null || value === undefined) return "-";
    return typeof value === "object" && typeof value.toString === "function" ? value.toString() : value;
};

exports.exportScansCSV = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = req.query.event_id ? Number(req.query.event_id) : null;
        const clock = reportClock(req.query.tz);

        const whereClause = {
            qr_code: {
                event: {
                    org_id: orgId
                }
            }
        };

        if (eventId) {
            whereClause.qr_code.event_id = eventId;
        }

        const filePath = path.join(__dirname, "../../tmp", `scans_export_${Date.now()}.csv`);
        const directory = path.dirname(filePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        const header = [
            { id: "qrId", title: "ID QR" },
            { id: "token", title: "TOKEN QR" },
            { id: "holder", title: "DÉTENTEUR" },
            { id: "email", title: "EMAIL" },
            { id: "phone", title: "TÉLÉPHONE" },
            { id: "event", title: "ÉVÉNEMENT" },
            { id: "qrStatus", title: "STATUT QR" },
            { id: "scansCount", title: "NOMBRE DE SCANS AUTORISÉS" },
            { id: "usageLimit", title: "LIMITE DE SCANS" },
            { id: "scanDate", title: "DATE DU SCAN" },
            { id: "scanTime", title: "HEURE DU SCAN" },
            { id: "zone", title: "ZONE" },
            { id: "agent", title: "SCANNÉ PAR" },
            { id: "result", title: "RÉSULTAT DU SCAN" },
            { id: "latitude", title: "LATITUDE" },
            { id: "longitude", title: "LONGITUDE" }
        ];
        fs.writeFileSync(filePath, `\uFEFF${header.map(column => column.title).join(CSV_DELIMITER)}\n`);
        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header,
            fieldDelimiter: CSV_DELIMITER,
            append: true
        });

        let records;

        if (eventId) {
            const qrs = await prisma.qrCode.findMany({
                where: {
                    event_id: eventId,
                    event: { org_id: orgId }
                },
                select: {
                    qr_id: true,
                    unique_token: true,
                    holder_name: true,
                    holder_email: true,
                    holder_phone: true,
                    status: true,
                    scans_count: true,
                    usage_limit: true,
                    valid_until: true,
                    event: { select: { title: true } },
                    scan_logs: {
                        orderBy: { scanned_at: "desc" },
                        select: {
                            scanned_at: true,
                            location_lat: true,
                            location_long: true,
                            status: true,
                            area: { select: { area_name: true } },
                            scanned_by: { select: { full_name: true } }
                        }
                    }
                },
                orderBy: { qr_id: "asc" }
            });

            records = qrs.flatMap(qr => {
                const baseRecord = {
                    qrId: qr.qr_id,
                    token: qr.unique_token,
                    holder: qr.holder_name || "Anonyme",
                    email: qr.holder_email || "-",
                    phone: qr.holder_phone || "-",
                    event: qr.event.title,
                    qrStatus: formatQrStatus(qr),
                    scansCount: qr.scans_count,
                    usageLimit: formatUsageLimit(qr.usage_limit)
                };

                if (qr.scan_logs.length === 0) {
                    return [{
                        ...baseRecord,
                        scanDate: "-",
                        scanTime: "-",
                        zone: "-",
                        agent: "-",
                        result: "AUCUN SCAN",
                        latitude: "-",
                        longitude: "-"
                    }];
                }

                return qr.scan_logs.map(scan => ({
                    ...baseRecord,
                    scanDate: clock.date(scan.scanned_at),
                    scanTime: clock.time(scan.scanned_at),
                    zone: scan.area?.area_name || "-",
                    agent: scan.scanned_by?.full_name || "-",
                    result: formatScanStatus(scan.status),
                    latitude: formatLocationValue(scan.location_lat),
                    longitude: formatLocationValue(scan.location_long)
                }));
            });
        } else {
            const scans = await prisma.scanLog.findMany({
                where: whereClause,
                include: {
                    qr_code: {
                        select: {
                            qr_id: true,
                            unique_token: true,
                            holder_name: true,
                            holder_email: true,
                            holder_phone: true,
                            status: true,
                            scans_count: true,
                            usage_limit: true,
                            valid_until: true,
                            event: { select: { title: true } }
                        }
                    },
                    area: { select: { area_name: true } },
                    scanned_by: { select: { full_name: true } }
                },
                orderBy: { scanned_at: "desc" }
            });

            records = scans.map(s => ({
                qrId: s.qr_code.qr_id,
                token: s.qr_code.unique_token,
                holder: s.qr_code.holder_name || "Anonyme",
                email: s.qr_code.holder_email || "-",
                phone: s.qr_code.holder_phone || "-",
                event: s.qr_code.event.title,
                qrStatus: formatQrStatus(s.qr_code),
                scansCount: s.qr_code.scans_count,
                usageLimit: formatUsageLimit(s.qr_code.usage_limit),
                scanDate: clock.date(s.scanned_at),
                scanTime: clock.time(s.scanned_at),
                zone: s.area?.area_name || "-",
                agent: s.scanned_by?.full_name || "-",
                result: formatScanStatus(s.status),
                latitude: formatLocationValue(s.location_lat),
                longitude: formatLocationValue(s.location_long)
            }));
        }

        await csvWriter.writeRecords(records);

        res.download(filePath, "scans_history.csv", (err) => {
            if (err) console.error("Erreur lors de l'envoi du fichier :", err);
            // Supprimer le fichier après envoi
            fs.unlink(filePath, () => {});
        });

    } catch (error) {
        console.error("Erreur export CSV :", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'export CSV" });
    }
};

// Au-delà, le PDF devient illisible : il l'annonce et renvoie vers l'export CSV, qui est complet.
const PDF_MAX_ROWS = 5000;
// A4 paysage (842 × 595) : six colonnes lisibles.
const PDF_COLUMNS = [
    { title: "Date et heure", x: 50, width: 90 },
    { title: "Détenteur", x: 145, width: 135 },
    { title: "Événement", x: 285, width: 140 },
    { title: "Zone", x: 430, width: 90 },
    { title: "Agent", x: 525, width: 105 },
    { title: "Résultat", x: 635, width: 157 }
];

exports.exportScansPDF = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = req.query.event_id ? Number(req.query.event_id) : null;
        const clock = reportClock(req.query.tz);

        const whereClause = {
            qr_code: {
                event: { org_id: orgId }
            }
        };
        if (eventId) whereClause.qr_code.event_id = eventId;

        const scans = await prisma.scanLog.findMany({
            where: whereClause,
            include: {
                qr_code: { select: { unique_token: true, holder_name: true, event: { select: { title: true } } } },
                area: { select: { area_name: true } },
                scanned_by: { select: { full_name: true } }
            },
            orderBy: { scanned_at: "desc" },
            take: PDF_MAX_ROWS + 1
        });
        const truncated = scans.length > PDF_MAX_ROWS;
        const rows = truncated ? scans.slice(0, PDF_MAX_ROWS) : scans;
        const authorized = rows.filter(scan => scan.status === "authorized").length;
        const eventTitle = eventId && rows[0]?.qr_code?.event?.title;

        // On génère toujours le fichier PDF pour éviter des pages d'erreur JSON disgracieuses
        const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 50 });
        const filename = `rapport_scans_${Date.now()}.pdf`;

        res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-type", "application/pdf");

        doc.pipe(res);

        // En-tête : titre, périmètre, date de génération et synthèse.
        doc.font("Helvetica-Bold").fontSize(20).text("Rapport des scans", 50, 50);
        doc.font("Helvetica").fontSize(11).text(eventTitle || (eventId ? "Événement" : "Tous les événements"), 50, 78);
        doc.fontSize(9).text(`Généré le ${clock.dateTime(new Date())} (${clock.zone})`, 50, 96);
        doc.fontSize(11).text(`${rows.length} scan${rows.length > 1 ? "s" : ""} · ${authorized} autorisé${authorized > 1 ? "s" : ""} · ${rows.length - authorized} refusé${rows.length - authorized > 1 ? "s" : ""}`, 50, 116);
        if (truncated) {
            doc.fontSize(9).text(`Rapport limité aux ${PDF_MAX_ROWS} scans les plus récents : utilisez l'export CSV pour l'historique complet.`, 50, 134);
        }

        const drawHeader = (y) => {
            doc.font("Helvetica-Bold").fontSize(9);
            PDF_COLUMNS.forEach(column => doc.text(column.title, column.x, y, { width: column.width, lineBreak: false }));
            doc.font("Helvetica");
        };
        let y = 160;
        if (rows.length === 0) {
            doc.fontSize(12).text("Aucun scan n'a été enregistré pour cet événement ou période.", 50, y);
        } else {
            drawHeader(y);
            y += 20;
            rows.forEach(scan => {
                if (y > 530) {
                    doc.addPage();
                    y = 50;
                    drawHeader(y);
                    y += 20;
                }
                const cells = [
                    clock.dateTime(scan.scanned_at),
                    scan.qr_code.holder_name || "Anonyme",
                    scan.qr_code.event.title,
                    scan.area?.area_name || "-",
                    scan.scanned_by?.full_name || "-",
                    formatScanStatus(scan.status)
                ];
                doc.fontSize(9);
                PDF_COLUMNS.forEach((column, index) => doc.text(cells[index], column.x, y, { width: column.width, lineBreak: false, ellipsis: true }));
                y += 16;
            });
        }

        doc.end();

    } catch (error) {
        console.error("Erreur export PDF :", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'export PDF" });
    }
};
