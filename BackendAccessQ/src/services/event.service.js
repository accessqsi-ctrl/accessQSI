const prisma = require("../prisma/client");

// Rechercher par nom (filtré par organisation)
exports.findByTitle = async (orgId, titleSearch) => {
  return await prisma.event.findMany({
    where: {
      org_id: orgId,
      OR: [
        { title: { contains: titleSearch, mode: 'insensitive' } },
        { location: { contains: titleSearch, mode: 'insensitive' } },
        { description: { contains: titleSearch, mode: 'insensitive' } }
      ],
      deleted_at: null
    },
    include: {
      EventSchedules: {
        include: { area: true },
        orderBy: { start_date: 'asc' }
      },
      _count: {
        select: { qr_codes: { where: { status: 'active', deleted_at: null } } }
      }
    },
    orderBy: { created_at: 'desc' }
  });
};

// Rechercher par ID (filtré par organisation)
exports.findById = async (orgId, eventId) => {
  return await prisma.event.findFirst({
    where: { event_id: eventId, org_id: orgId, deleted_at: null },
    include: {
      EventSchedules: {
        include: { area: true },
        orderBy: { start_date: 'asc' }
      },
      _count: {
        select: { qr_codes: { where: { status: 'active', deleted_at: null } } }
      }
    }
  });
};

// Récupérer tous les événements (filtré par organisation)
exports.findAll = async (orgId) => {
  return await prisma.event.findMany({
    where: {
      org_id: orgId,
      deleted_at: null
    },
    include: {
      EventSchedules: {
        include: { area: true },
        orderBy: { start_date: 'asc' }
      },
      _count: {
        select: { qr_codes: { where: { status: 'active', deleted_at: null } } }
      }
    },
    orderBy: { created_at: 'desc' }
  });
};

// Créer un événement (lié à l'organisation)
exports.createEvent = async (data) => {
  const { start_date, end_date, id_area, areaIds, ...eventData } = data;

  const idsToCreate = areaIds && Array.isArray(areaIds) ? areaIds : (id_area ? [Number(id_area)] : [1]);

  return await prisma.event.create({
    data: {
      ...eventData,
      EventSchedules: {
        create: idsToCreate.map(id => ({
          start_date: start_date,
          end_date: end_date,
          id_area: Number(id)
        }))
      }
    },
    include: { EventSchedules: true }
  });
};

// Modifier un événement (propriété vérifiée par le contrôleur)
exports.updateEvent = async (eventId, data) => {
  const { start_date, end_date, id_area, areaIds, ...eventData } = data;

  const updateData = { ...eventData };

  if (start_date || end_date || id_area || areaIds) {
    // Si pas de areaIds explicites mais on a id_area, l'utiliser
    const finalAreaIds = areaIds && Array.isArray(areaIds) 
        ? areaIds.map(Number) 
        : (id_area ? [Number(id_area)] : null);

    if (finalAreaIds) {
      // Méthode simple pour synchroniser : supprimer tout et recréer
      await prisma.eventSchedule.deleteMany({
        where: { id_event: eventId }
      });

      await prisma.eventSchedule.createMany({
        data: finalAreaIds.map(id => ({
          id_event: eventId,
          id_area: id,
          start_date: start_date ? new Date(start_date) : new Date(),
          end_date: end_date ? new Date(end_date) : new Date()
        }))
      });
    } else if (start_date || end_date) {
        // Mettre à jour uniquement les dates si les zones n'ont pas changé
        await prisma.eventSchedule.updateMany({
            where: { id_event: eventId },
            data: {
                start_date: start_date ? new Date(start_date) : undefined,
                end_date: end_date ? new Date(end_date) : undefined
            }
        });
    }
  }

  return prisma.event.update({
    where: { event_id: eventId },
    data: updateData,
    include: { EventSchedules: true }
  });
};

// Supprimer un événement (Suppression logique)
exports.deleteEvent = async (eventId) => {
  return prisma.event.update({
    where: { event_id: eventId },
    data: {
      deleted_at: new Date()
    }
  });
};

