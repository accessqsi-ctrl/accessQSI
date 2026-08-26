const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.disable('x-powered-by');

// Static files
app.use(express.static(path.join(__dirname, 'src/public')));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Routes
const indexRoutes = require('./src/routes/index.routes');
app.use('/', indexRoutes);

// Error handling
app.use((req, res) => {
    res.status(404).send('Page introuvable');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Une erreur interne est survenue.');
});

app.listen(PORT, () => {
    console.log(`AdministrationAccess server is running on port ${PORT}`);
});
