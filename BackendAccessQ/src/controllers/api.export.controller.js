const prisma = require("../prisma/client");
const { createObjectCsvWriter } = require("csv-writer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

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

        const scans = await prisma.scanLog.findMany({
            where: whereClause,
            include: {
                qr_code: {
                    select: {
                        unique_token: true,
                        holder_name: true,
                        holder_email: true,
                        event: { select: { title: true } }
                    }
                },
                scanned_by: { select: { full_name: true } }
            },
            orderBy: { scanned_at: "desc" }
        });

        // Supprimé : if (scans.length === 0) return res.status(404).json(...)
        // On génère toujours le fichier CSV, même vide, pour éviter des pages d'erreur disgracieuses


        const filePath = path.join(__dirname, "../../tmp", `scans_export_${Date.now()}.csv`);
        const directory = path.dirname(filePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: [
                { id: "date", title: "DATE" },
                { id: "time", title: "HEURE" },
                { id: "token", title: "TOKEN QR" },
                { id: "holder", title: "DETENTEUR" },
                { id: "email", title: "EMAIL" },
                { id: "event", title: "EVENEMENT" },
                { id: "agent", title: "AGENT" },
                { id: "status", title: "STATUT" }
            ]
        });

        const records = scans.map(s => ({
            date: new Date(s.scanned_at).toLocaleDateString(),
            time: new Date(s.scanned_at).toLocaleTimeString(),
            token: s.qr_code.unique_token,
            holder: s.qr_code.holder_name || "Anonyme",
            email: s.qr_code.holder_email || "-",
            event: s.qr_code.event.title,
            agent: s.scanned_by.full_name,
            status: s.status === "authorized" ? "AUTORISÉ" : "REFUSÉ"
        }));

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
