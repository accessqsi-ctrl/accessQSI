const eventService = require('../services/event.service');

// Récupérer tous les événements de l'organisation courante
exports.getEvents = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const search = req.query.search;

        let events;
        if (search) {
            events = await eventService.findByTitle(orgId, search);
        } else {
            events = await eventService.findAll(orgId);
        }

        // Formatage pour le frontend
        const formattedEvents = events.map(e => {
            const now = new Date();
            const schedules = e.EventSchedules || [];
            const firstSchedule = schedules[0];
            const lastSchedule = schedules[schedules.length - 1];

            let status = "Actif";
            if (firstSchedule && new Date(firstSchedule.start_date) > now) status = "À venir";
            if (lastSchedule && new Date(lastSchedule.end_date) < now) status = "Passé";

            const startDateStr = firstSchedule ? new Date(firstSchedule.start_date).toLocaleDateString() : 'N/A';
            const endDateStr = lastSchedule ? new Date(lastSchedule.end_date).toLocaleDateString() : 'N/A';

            // Lister tous les noms de zones
            const locationNames = schedules.map(s => s.area?.area_name).filter(Boolean).join(", ") || "N/A";

            return {
                id: e.event_id,
                name: e.title,
                date: `${startDateStr} - ${endDateStr}`,
                startDate: firstSchedule ? firstSchedule.start_date : null,
                endDate: lastSchedule ? lastSchedule.end_date : null,
                location: locationNames,
                qrs: e._count?.qr_codes || 0,
                status: status
            };
        });

        res.status(200).json({ success: true, events: formattedEvents });
    } catch (error) {
        console.error("Erreur lors de la récupération des événements :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
}

// Récupérer les détails d'un événement
exports.getEventById = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);

        const event = await eventService.findById(orgId, eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Événement introuvable" });
        }

        res.status(200).json({ success: true, event });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'événement :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
}

// Créer un nouvel événement
exports.createEvent = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const { title, description, id_area, areaIds, startDate, endDate } = req.body;

        if (!title || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Titre, Date de début et Date de fin sont requis" });
        }

        const orgId = req.user.org_id;

        const newEvent = await eventService.createEvent({
            title: title,
            description: description,
            id_area: id_area,
            areaIds: areaIds,
            start_date: new Date(startDate),
            end_date: new Date(endDate),
            org_id: orgId
        });

        res.status(201).json({ success: true, message: 'Événement créé avec succès', event: newEvent });
    } catch (error) {
        console.error("Erreur lors de la création de l'événement :", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la création" });
    }
}

// Modifier un événement
exports.updateEvent = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);
        const { title, description, id_area, areaIds, startDate, endDate } = req.body;

        // Vérifier la propriété d'abord
        const existingEvent = await eventService.findById(orgId, eventId);
        if (!existingEvent) {
            return res.status(404).json({ success: false, message: "Événement introuvable ou non autorisé" });
        }

        const updatedEvent = await eventService.updateEvent(eventId, {
            title,
            description,
            id_area,
            areaIds,
            start_date: startDate ? new Date(startDate) : undefined,
            end_date: endDate ? new Date(endDate) : undefined
        });

        res.status(200).json({ success: true, message: 'Événement mis à jour', event: updatedEvent });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'événement :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
}

// Supprimer un événement (Suppression logique)
exports.deleteEvent = async (req, res) => {
    try {
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé" });
        }

        const orgId = req.user.org_id;
        const eventId = Number(req.params.event_id);

        // Vérifier la propriété
        const existingEvent = await eventService.findById(orgId, eventId);
        if (!existingEvent) {
            return res.status(404).json({ success: false, message: "Événement introuvable" });
        }

        await eventService.deleteEvent(eventId);
        res.status(200).json({ success: true, message: 'Événement supprimé' });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'événement :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
}
