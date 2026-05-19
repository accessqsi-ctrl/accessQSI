# Utiliser une image Node.js officielle optimisée (alpine)
FROM node:20-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copier les fichiers contenant les dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers du projet
COPY . .

# Exposer le port défini dans server.js (5000 par défaut)
EXPOSE 5000

# Générer le client Prisma au démarrage (après injection du .env), puis lancer le serveur
CMD ["sh", "-c", "npx prisma generate && node server.js"]
