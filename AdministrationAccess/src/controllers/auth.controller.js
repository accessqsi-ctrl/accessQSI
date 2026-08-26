const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');

const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET_MISSING');
    }
    return process.env.JWT_SECRET;
};

exports.renderLogin = (req, res) => {
    // If already logged in, redirect to dashboard
    const token = req.cookies.adminToken;
    if (token) {
        try {
            jwt.verify(token, getJwtSecret());
            return res.redirect('/dashboard');
        } catch (e) {
            // Invalid token, proceed to login
        }
    }
    res.render('login', { error: null, email: '' });
};

exports.login = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).render('login', {
                error: 'Veuillez saisir votre adresse e-mail et votre mot de passe.',
                email
            });
        }
        
        // Find user by email and ensure they are SUPER_ADMIN
        const user = await prisma.userQ.findUnique({
            where: { email }
        });

        if (!user || user.role !== 'SUPER_ADMIN') {
            return res.status(401).render('login', { error: 'Identifiants invalides ou accès refusé.', email });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).render('login', { error: 'Identifiants invalides ou accès refusé.', email });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.user_id, role: user.role, email: user.email },
            getJwtSecret(),
            { expiresIn: '1d' }
        );

        // Set cookie
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        const message = error.message === 'JWT_SECRET_MISSING'
            ? 'La configuration de sécurité du serveur est incomplète.'
            : 'Une erreur est survenue lors de la connexion.';
        res.status(500).render('login', { error: message, email: String(req.body.email || '') });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('adminToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.redirect('/login');
};

exports.requireAuth = (req, res, next) => {
    const token = req.cookies.adminToken;
    
    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        req.user = decoded;
        
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.redirect('/login');
        }
        
        next();
    } catch (error) {
        return res.redirect('/login');
    }
};

exports.renderDashboard = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const [totalUsers, activeUsers, totalOrganizations, activeOrganizations, totalEvents, scansToday] = await Promise.all([
            prisma.userQ.count({ where: { deleted_at: null } }),
            prisma.userQ.count({ where: { deleted_at: null, is_active: true } }),
            prisma.organization.count({ where: { deleted_at: null } }),
            prisma.organization.count({ where: { deleted_at: null, is_active: true } }),
            prisma.event.count({ where: { deleted_at: null } }),
            prisma.scanLog.count({ where: { scanned_at: { gte: startOfDay } } })
        ]);

        res.render('dashboard', {
            user: req.user,
            stats: {
                totalUsers,
                totalOrganizations,
                totalEvents,
                activeUsers,
                activeOrganizations,
                scansToday
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('dashboard', {
            user: req.user,
            stats: {
                totalUsers: 0,
                activeUsers: 0,
                totalOrganizations: 0,
                activeOrganizations: 0,
                totalEvents: 0,
                scansToday: 0
            },
            error: 'Erreur lors du chargement des statistiques.'
        });
    }
};
