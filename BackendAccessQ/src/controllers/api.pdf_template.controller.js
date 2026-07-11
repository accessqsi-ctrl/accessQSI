const fs = require("fs");
const pdfTemplateService = require("../services/pdf_template.service");

exports.listTemplates = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            templates: pdfTemplateService.listTemplates()
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erreur lors du chargement des modèles PDF." });
    }
};

exports.generatePdf = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const result = await pdfTemplateService.generateDocument({
            templateId: req.body.templateId,
            values: req.body.values || {}
        });

        return res.status(201).json({
            success: true,
            document: result
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode ? error.message : "Erreur lors de la génération du PDF."
        });
    }
};

exports.previewTemplate = async (req, res) => {
    const template = pdfTemplateService.getTemplate(req.params.templateId);
    if (!template) {
        return res.status(404).json({ success: false, message: "Modèle PDF introuvable" });
    }

    const filePath = pdfTemplateService.templatePathForId(template.id);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "Fichier du modèle introuvable" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${template.id}.pdf"`);
    return fs.createReadStream(filePath).pipe(res);
};

exports.downloadGeneratedPdf = async (req, res) => {
    const filename = String(req.params.filename || "");
    if (!/^document_[a-zA-Z0-9_-]+_\d+_[a-f0-9]{12}\.pdf$/.test(filename)) {
        return res.status(400).json({ success: false, message: "Nom de fichier invalide" });
    }

    const filePath = pdfTemplateService.generatedPathForFilename(filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "Document introuvable" });
    }

    return res.download(filePath, filename);
};
