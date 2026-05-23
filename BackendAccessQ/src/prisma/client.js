const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// Fermer proprement la connexion à l'arrêt du serveur
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
