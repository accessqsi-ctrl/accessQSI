const prisma = require("../prisma/client");
const { createObjectCsvWriter } = require("csv-writer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const formatScanStatus = (status) => {
    const labels = {
        authorized: "AUTORISÉ",
        denied_expired: "REFUSÉ - EXPIRÉ",
        denied_revoked: "REFUSÉ - RÉVOQUÉ",
        denied_limit_reached: "REFUSÉ - LIMITE ATTEINTE"
    };
    return labels[status] || status || "-";
};

const formatUsageLimit = (limit) => {
    return limit > 9999 ? "Illimité" : limit;
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

        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: [
                { id: "qrId", title: "ID QR" },
                { id: "token", title: "TOKEN QR" },
                { id: "holder", title: "DETENTEUR" },
                { id: "email", title: "EMAIL" },
                { id: "phone", title: "TELEPHONE" },
                { id: "event", title: "EVENEMENT" },
                { id: "qrStatus", title: "STATUT QR" },
                { id: "scansCount", title: "NOMBRE DE SCANS AUTORISES" },
                { id: "usageLimit", title: "LIMITE DE SCANS" },
                { id: "scanDate", title: "DATE DU SCAN" },
                { id: "scanTime", title: "HEURE DU SCAN" },
                { id: "agent", title: "SCANNÉ PAR" },
                { id: "result", title: "RESULTAT DU SCAN" },
                { id: "latitude", title: "LATITUDE" },
                { id: "longitude", title: "LONGITUDE" }
            ]
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
                    event: { select: { title: true } },
                    scan_logs: {
                        orderBy: { scanned_at: "desc" },
                        select: {
                            scanned_at: true,
                            location_lat: true,
                            location_long: true,
                            status: true,
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
                    qrStatus: qr.status,
                    scansCount: qr.scans_count,
                    usageLimit: formatUsageLimit(qr.usage_limit)
                };

                if (qr.scan_logs.length === 0) {
                    return [{
                        ...baseRecord,
                        scanDate: "-",
                        scanTime: "-",
                        agent: "-",
                        result: "AUCUN SCAN",
                        latitude: "-",
                        longitude: "-"
                    }];
                }

                return qr.scan_logs.map(scan => ({
                    ...baseRecord,
                    scanDate: new Date(scan.scanned_at).toLocaleDateString(),
                    scanTime: new Date(scan.scanned_at).toLocaleTimeString(),
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
                            event: { select: { title: true } }
                        }
                    },
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
                qrStatus: s.qr_code.status,
                scansCount: s.qr_code.scans_count,
                usageLimit: formatUsageLimit(s.qr_code.usage_limit),
                scanDate: new Date(s.scanned_at).toLocaleDateString(),
                scanTime: new Date(s.scanned_at).toLocaleTimeString(),
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

exports.exportScansPDF = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = req.query.event_id ? Number(req.query.event_id) : null;

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
                scanned_by: { select: { full_name: true } }
            },
            orderBy: { scanned_at: "desc" },
            take: 100 // Limite pour la démo PDF
        });

        // On génère toujours le fichier PDF pour éviter des pages d'erreur JSON disgracieuses


        const doc = new PDFDocument();
        const filename = `report_${Date.now()}.pdf`;

        res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-type", "application/pdf");

        doc.pipe(res);

        // En-tête
        doc.fontSize(20).text("Rapport d'Accès QR", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Généré le: ${new Date().toLocaleString()}`, { align: "right" });
        doc.moveDown();

        // En-tête du tableau
        const tableTop = 150;
        doc.font("Helvetica-Bold");
        doc.text("Date", 50, tableTop);
        doc.text("Détenteur", 150, tableTop);
        doc.text("Événement", 300, tableTop);
        doc.text("Agent", 450, tableTop);
        doc.moveDown();

        doc.font("Helvetica");
        let y = 170;
        if (scans.length === 0) {
            doc.fontSize(12).text("Aucun scan n'a été enregistré pour cet événement ou période.", { align: "center", color: "red" });
        } else {
            scans.forEach(s => {
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }
                doc.fontSize(10);
                doc.text(new Date(s.scanned_at).toLocaleString(), 50, y);
                doc.text(s.qr_code.holder_name || "Anonyme", 150, y);
                doc.text(s.qr_code.event.title.substring(0, 20), 300, y);
                doc.text(s.scanned_by.full_name, 450, y);
                y += 20;
            });
        }


        doc.end();

    } catch (error) {
        console.error("Erreur export PDF :", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'export PDF" });
    }
};
