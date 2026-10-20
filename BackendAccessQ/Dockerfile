# Utiliser une image Node.js LTS officielle optimisée (alpine)
FROM node:22-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Installer uniquement les dépendances de production, à l'identique du package-lock
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le reste des fichiers du projet (les clés *.pem et le .env sont exclus par .dockerignore)
COPY . .

# Générer le client Prisma au build : il ne dépend pas des variables d'environnement
RUN npx prisma generate

# Exposer le port défini dans server.js (5000 par défaut)
EXPOSE 5000

# Appliquer les migrations en attente, puis lancer le serveur.
# Le worker d'inscriptions réutilise cette image avec une autre commande (voir docker-compose.yml).
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
