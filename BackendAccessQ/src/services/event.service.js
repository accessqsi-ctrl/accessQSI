const prisma = require("../prisma/client");

const getScheduleAreaIds = ({ id_area, areaIds }) => {
  if (areaIds && Array.isArray(areaIds)) {
    return [...new Set(areaIds.map(Number).filter(Number.isFinite))];
  }

  if (id_area !== undefined && id_area !== null) {
    const areaId = Number(id_area);
    return Number.isFinite(areaId) ? [areaId] : [];
  }

  return [];
};

const assertAreasBelongToOrg = async (tx, orgId, areaIds) => {
  if (!areaIds.length) {
    const error = new Error("Au moins une zone valide est requise.");
    error.code = "INVALID_EVENT_AREAS";
    throw error;
  }

  const count = await tx.area.count({
    where: {
      org_id: orgId,
      area_id: { in: areaIds },
      deleted_at: null
    }
  });

  if (count !== areaIds.length) {
    const error = new Error("Une ou plusieurs zones sont introuvables pour cette organisation.");
    error.code = "INVALID_EVENT_AREAS";
    throw error;
  }
};

// Rechercher par nom (filtré par organisation)
exports.findByTitle = async (orgId, titleSearch) => {
  return await prisma.event.findMany({
    where: {
      org_id: orgId,
      OR: [
        { title: { contains: titleSearch, mode: 'insensitive' } },
        { description: { contains: titleSearch, mode: 'insensitive' } },
        {
          EventSchedules: {
            some: {
              area: {
                area_name: { contains: titleSearch, mode: 'insensitive' }
              }
            }
          }
        }
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
  const idsToCreate = getScheduleAreaIds({ id_area, areaIds });

  return await prisma.$transaction(async (tx) => {
    await assertAreasBelongToOrg(tx, eventData.org_id, idsToCreate);

    return tx.event.create({
      data: {
        ...eventData,
        EventSchedules: {
          create: idsToCreate.map(id => ({
            start_date: start_date,
            end_date: end_date,
            id_area: id
          }))
        }
      },
      include: { EventSchedules: true }
    });
  });
};

// Modifier un événement (propriété vérifiée par le contrôleur)
exports.updateEvent = async (eventId, data, orgId) => {
  const { start_date, end_date, id_area, areaIds, ...eventData } = data;

  const updateData = Object.fromEntries(
    Object.entries(eventData).filter(([, value]) => value !== undefined)
  );

  return prisma.$transaction(async (tx) => {
    if (start_date || end_date || id_area !== undefined || areaIds !== undefined) {
      const shouldSyncAreas = areaIds !== undefined || id_area !== undefined;
      const finalAreaIds = shouldSyncAreas ? getScheduleAreaIds({ id_area, areaIds }) : null;

      if (finalAreaIds) {
        await assertAreasBelongToOrg(tx, orgId, finalAreaIds);

        const existingSchedule = await tx.eventSchedule.findFirst({
          where: { id_event: eventId },
          orderBy: { start_date: 'asc' }
        });

        await tx.eventSchedule.deleteMany({
          where: { id_event: eventId }
        });

        await tx.eventSchedule.createMany({
          data: finalAreaIds.map(id => ({
            id_event: eventId,
            id_area: id,
            start_date: start_date || existingSchedule?.start_date || new Date(),
            end_date: end_date || existingSchedule?.end_date || new Date()
          }))
        });
      } else if (start_date || end_date) {
          await tx.eventSchedule.updateMany({
              where: { id_event: eventId },
              data: {
                  start_date: start_date || undefined,
                  end_date: end_date || undefined
              }
          });
      }
    }

    return tx.event.update({
      where: { event_id: eventId },
      data: updateData,
      include: { EventSchedules: true }
    });
  });
};

// Supprimer un événement (Suppression logique)
exports.deleteEvent = async (eventId) => {
  return prisma.$transaction(async (tx) => {
    const deletedAt = new Date();
    const qrCodes = await tx.qrCode.findMany({
      where: { event_id: eventId, deleted_at: null },
      select: { unique_token: true }
    });
    const event = await tx.event.update({
      where: { event_id: eventId },
      data: { deleted_at: deletedAt }
    });

    await tx.qrCode.updateMany({
      where: { event_id: eventId, deleted_at: null },
      data: { status: "revoked", deleted_at: deletedAt }
    });

    return {
      ...event,
      qr_tokens: qrCodes.map(qr => qr.unique_token)
    };
  });
};
