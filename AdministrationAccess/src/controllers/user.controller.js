const prisma = require('../lib/prisma');

const parseId = (value) => {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
};

exports.listUsers = async (req, res) => {
    try {
        const users = await prisma.userQ.findMany({
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
        await prisma.userQ.update({
            where: { user_id: userId },
            data: { is_active: false }
        });
        res.redirect('/users?success=Utilisateur désactivé avec succès.');
    } catch (error) {
        console.error("Erreur deactivateUser:", error);
        res.redirect('/users?error=Erreur lors de la désactivation.');
    }
};

exports.activateUser = async (req, res) => {
    const userId = parseId(req.params.id);
    if (!userId) return res.redirect('/users?error=Utilisateur invalide.');
    try {
        const result = await prisma.userQ.updateMany({
            where: { user_id: userId, deleted_at: null, suspended_by_plan: false },
            data: { is_active: true }
        });
        if (result.count === 0) {
            return res.redirect('/users?error=Ce compte est archivé ou suspendu par son plan.');
        }
        res.redirect('/users?success=Utilisateur réactivé avec succès.');
    } catch (error) {
        console.error("Erreur activateUser:", error);
        res.redirect('/users?error=Erreur lors de la réactivation.');
    }
};
