const prisma = require('../lib/prisma');
const { AGENT_ROLES, setAgentActive } = require('../services/agent-access.service');
const { writeAudit } = require('../services/audit.service');

const parseId = (value) => {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
};

exports.listUsers = async (req, res) => {
    try {
        const users = await prisma.userQ.findMany({
            where: { role: { in: [...AGENT_ROLES] }, deleted_at: null },
            include: {
                organization: {
                    select: { name: true }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        res.render('users/list', {
            user: req.user,
            users,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error("Erreur listUsers:", error);
        res.render('users/list', {
            user: req.user,
            users: [],
            error: "Erreur lors du chargement des utilisateurs.",
            success: null
        });
    }
};

exports.deactivateUser = async (req, res) => {
    const userId = parseId(req.params.id);
    if (!userId) return res.redirect('/users?error=Utilisateur invalide.');
    if (req.user.id === userId) return res.redirect('/users?error=Vous ne pouvez pas désactiver votre propre compte.');
    try {
        const result = await setAgentActive({ userId, active: false });
        writeAudit({ actorId: req.user.id, action: 'AGENT_DEACTIVATED', targetType: 'USER', targetId: userId, organizationId: result.organizationId });
        res.redirect('/users?success=Agent désactivé avec succès.');
    } catch (error) {
        console.error("Erreur deactivateUser:", error);
        res.redirect('/users?error=Erreur lors de la désactivation.');
    }
};

exports.activateUser = async (req, res) => {
    const userId = parseId(req.params.id);
    if (!userId) return res.redirect('/users?error=Utilisateur invalide.');
    try {
        const result = await setAgentActive({ userId, active: true });
        writeAudit({ actorId: req.user.id, action: 'AGENT_ACTIVATED', targetType: 'USER', targetId: userId, organizationId: result.organizationId });
        res.redirect('/users?success=Agent réactivé avec succès.');
    } catch (error) {
        console.error("Erreur activateUser:", error);
        const messages = {
            AGENT_NOT_FOUND: 'Agent introuvable.',
            AGENT_ARCHIVED: 'Un agent archivé ne peut pas être réactivé.',
            AGENT_SUSPENDED_BY_PLAN: 'Cet agent est suspendu par le plan.',
            ORGANIZATION_INACTIVE: 'Réactivez d’abord l’organisation de cet agent.',
            PLAN_QUOTA_EXCEEDED: `Le quota d’agents actifs est atteint (${error.currentCount}/${error.limit}).`
        };
        res.redirect(`/users?error=${encodeURIComponent(messages[error.code] || 'Erreur lors de la réactivation.')}`);
    }
};
