const areaService = require('../services/area.service');

exports.getAreas = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }
        const areas = await areaService.findAll(req.user.org_id);
        res.status(200).json({ success: true, areas });
    } catch (error) {
        console.error("Erreur lors de la récupération des zones :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.getAreaById = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }
        const area = await areaService.findById(req.user.org_id, Number(req.params.id));
        if (!area) {
            return res.status(404).json({ success: false, message: "Zone introuvable" });
        }
        res.status(200).json({ success: true, area });
    } catch (error) {
        console.error("Erreur lors de la récupération de la zone :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.createArea = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }
        const { area_name, accreditation_level } = req.body;
        if (!area_name || accreditation_level === undefined) {
            return res.status(400).json({ success: false, message: "Nom et niveau d'accréditation requis" });
        }
        const newArea = await areaService.createArea({
            area_name,
            accreditation_level: Number(accreditation_level),
            org_id: req.user.org_id
        });
        res.status(201).json({ success: true, area: newArea });
    } catch (error) {
        console.error("Erreur lors de la création de la zone :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.updateArea = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }
        const areaId = Number(req.params.id);
        const existingArea = await areaService.findById(req.user.org_id, areaId);
        if (!existingArea) {
            return res.status(404).json({ success: false, message: "Zone introuvable" });
        }
        const updatedArea = await areaService.updateArea(areaId, req.body);
        res.status(200).json({ success: true, area: updatedArea });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la zone :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.deleteArea = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }
        const areaId = Number(req.params.id);
        const existingArea = await areaService.findById(req.user.org_id, areaId);
        if (!existingArea) {
            return res.status(404).json({ success: false, message: "Zone introuvable" });
        }
        await areaService.deleteArea(areaId);
        res.status(200).json({ success: true, message: "Zone supprimée" });
    } catch (error) {
        console.error("Erreur lors de la suppression de la zone :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};
