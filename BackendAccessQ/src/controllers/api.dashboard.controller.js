const prisma = require("../prisma/client");

exports.getOverviewStats = async (req, res) => {
    try {
        console.log(req.ip);
        // Vérifier que l'utilisateur est authentifié et a une organisation
        if (!req.user || !req.user.org_id) {
            return res.status(401).json({ success: false, message: "Non autorisé ou aucune organisation liée." });
        }

        const orgId = req.user.org_id;
        const now = new Date();

        // 1. Total de QR Codes actifs pour l'organisation
        const activeQrCount = await prisma.qrCode.count({
            where: {
                event: { org_id: orgId },
                status: "active",
                deleted_at: null
            }
        });

        // 2. Total des scans (global pour les QR codes de l'organisation)
        const totalScansInfo = await prisma.qrCode.aggregate({
            _sum: {
                scans_count: true
            },
            where: {
                event: { org_id: orgId }
            }
        });
        const totalScans = totalScansInfo._sum.scans_count || 0;

        // 3. Événements à venir
        const upcomingEventsCount = await prisma.event.count({
            where: {
                org_id: orgId,
                EventSchedules: {
                    some: {
                        start_date: { gt: now }
                    }
                },
                deleted_at: null
            }
        });

        // Récupérer le nom du prochain événement pour le sous-titre
        const nextEventSchedule = await prisma.eventSchedule.findFirst({
            where: {
                event: {
                    org_id: orgId,
                    deleted_at: null
                },
                start_date: { gt: now }
            },
            orderBy: {
                start_date: 'asc'
            },
            include: {
                event: {
                    select: { title: true }
                }
            }
        });
        const nextEvent = nextEventSchedule ? nextEventSchedule.event : null;

        // 4. Agents actifs (ORG_AGENT ou OPERATOR)
        const activeAgentsCount = await prisma.userQ.count({
            where: {
                org_id: orgId,
                role: { in: ['ORG_AGENT', 'OPERATOR'] },
                deleted_at: null
            }
        });

        // 6. Scans par jour (7 derniers jours)
        const scansByDay = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const count = await prisma.scanLog.count({
                where: {
                    qr_code: { event: { org_id: orgId } },
                    scanned_at: {
                        gte: date,
                        lt: nextDay
                    }
                }
            });

            scansByDay.push({
                name: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
                fullDate: date.toLocaleDateString('fr-FR'),
                scans: count
            });
        }

        // 7. Meilleurs agents par nombre de scans
        const topAgentsRaw = await prisma.scanLog.groupBy({
            by: ['scanned_by_id'],
            where: { qr_code: { event: { org_id: orgId } } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 3
        });

        const topAgents = await Promise.all(topAgentsRaw.map(async (item) => {
            const agent = await prisma.userQ.findUnique({
                where: { user_id: item.scanned_by_id },
                select: { full_name: true }
            });
            return {
                name: agent.full_name,
                count: item._count.id
            };
        }));

        // 5. Scans récents (5 derniers) - on les récupère à nouveau car le bloc précédent l'a remplacé
        const recentScans = await prisma.scanLog.findMany({
            where: { qr_code: { event: { org_id: orgId } } },
            take: 5,
            orderBy: { scanned_at: 'desc' },
            include: {
                qr_code: { select: { unique_token: true, event: { select: { title: true } } } },
                scanned_by: { select: { full_name: true } }
            }
        });

        const formattedScans = recentScans.map(scan => ({
            id: scan.id,
            code: scan.qr_code.unique_token.substring(0, 8),
            event: scan.qr_code.event.title,
            agent: scan.scanned_by.full_name,
            time: scan.scanned_at,
            status: scan.status
        }));

        return res.status(200).json({
            success: true,
            data: {
                activeQrs: activeQrCount,
                totalScans: totalScans,
                upcomingEvents: upcomingEventsCount,
                nextEventTitle: nextEvent ? nextEvent.title : "Aucun événement",
                activeAgents: activeAgentsCount,
                recentScans: formattedScans,
                scansByDay: scansByDay,
                topAgents: topAgents
            }
        });



    } catch (error) {
        console.error("Erreur lors de la récupération des stats du Dashboard: ", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors du chargement des statistiques."
        });
    }
};
