const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET_MISSING');
    }
    return process.env.JWT_SECRET;
};

const csrfCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000
});

const safeTokenMatch = (expectedValue, receivedValue) => {
    const expected = Buffer.from(String(expectedValue || ''), 'utf8');
    const received = Buffer.from(String(receivedValue || ''), 'utf8');
    return expected.length > 0 && expected.length === received.length && crypto.timingSafeEqual(expected, received);
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
    const loginCsrf = crypto.randomBytes(32).toString('hex');
    res.cookie('adminLoginCsrf', loginCsrf, csrfCookieOptions());
    res.render('login', { error: null, email: '', loginCsrf });
};

exports.requireLoginCsrf = (req, res, next) => {
    if (!safeTokenMatch(req.cookies?.adminLoginCsrf, req.body?._csrf)) {
        return res.status(403).send('Requête de connexion refusée : jeton de sécurité invalide.');
    }
    next();
};

exports.login = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            return res.status(400).render('login', {
                error: 'Veuillez saisir votre adresse e-mail et votre mot de passe.',
                email,
                loginCsrf: req.cookies?.adminLoginCsrf || ''
            });
        }
        
        // Find user by email and ensure they are SUPER_ADMIN
        const user = await prisma.userQ.findUnique({
            where: { email }
        });

        if (!user || user.role !== 'SUPER_ADMIN' || user.deleted_at || !user.is_active) {
            return res.status(401).render('login', { error: 'Identifiants invalides ou accès refusé.', email, loginCsrf: req.cookies?.adminLoginCsrf || '' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).render('login', { error: 'Identifiants invalides ou accès refusé.', email, loginCsrf: req.cookies?.adminLoginCsrf || '' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.user_id, role: user.role, email: user.email, csrf: crypto.randomBytes(32).toString('hex') },
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
        res.clearCookie('adminLoginCsrf', csrfCookieOptions());

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        const message = error.message === 'JWT_SECRET_MISSING'
            ? 'La configuration de sécurité du serveur est incomplète.'
            : 'Une erreur est survenue lors de la connexion.';
        res.status(500).render('login', { error: message, email: String(req.body.email || ''), loginCsrf: req.cookies?.adminLoginCsrf || '' });
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

exports.requireAuth = async (req, res, next) => {
    const token = req.cookies.adminToken;
    
    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        const currentUser = await prisma.userQ.findUnique({
            where: { user_id: Number(decoded.id) },
            select: { user_id: true, email: true, role: true, is_active: true, deleted_at: true }
        });
        if (!currentUser || currentUser.role !== 'SUPER_ADMIN' || !currentUser.is_active || currentUser.deleted_at) {
            res.clearCookie('adminToken');
            return res.redirect('/login');
        }
        req.user = { id: currentUser.user_id, email: currentUser.email, role: currentUser.role, csrf: decoded.csrf };
        next();
    } catch (error) {
        return res.redirect('/login');
    }
};

exports.requireCsrf = (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (!safeTokenMatch(req.user?.csrf, req.body?._csrf)) {
        return res.status(403).send('Requête refusée : jeton de sécurité invalide.');
    }
    next();
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
