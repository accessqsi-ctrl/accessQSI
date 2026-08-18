const prisma = require("../prisma/client");
const { assignOrganizationPlan, ensureDefaultPlans, PLAN_KEYS } = require("../config/subscription");

exports.findByEmail = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return prisma.userQ.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } }
  });
};

exports.createOrgAndAdminUser = async (orgData, userData) => {
  return await prisma.$transaction(async (tx) => {
    await ensureDefaultPlans(tx);

    const org = await tx.organization.create({
      data: orgData
    });

    await assignOrganizationPlan(tx, org.org_id, PLAN_KEYS.FREE);

    const user = await tx.userQ.create({
      data: {
        ...userData,
        org_id: org.org_id
      }
    });

    return { org, user };
  });
};
exports.updateUser = async (userId, data) => {
  return await prisma.userQ.update({
    where: { user_id: userId },
    data: data
  });
};

exports.updateOrganization = async (orgId, data) => {
  return await prisma.organization.update({
    where: { org_id: orgId },
    data: data
  });
};

exports.getOrganizationById = async (orgId) => {
  return await prisma.organization.findUnique({
    where: { org_id: orgId }
  });
};

exports.deleteOrganization = async (orgId) => {
  return await prisma.$transaction(async (tx) => {
    // Suppression logique de l'organisation
    const org = await tx.organization.update({
      where: { org_id: orgId },
      data: { deleted_at: new Date() }
    });

    // Suppression logique de tous les utilisateurs de cette organisation
    await tx.userQ.updateMany({
      where: { org_id: orgId },
      data: { deleted_at: new Date() }
    });

    return org;
  });
};
