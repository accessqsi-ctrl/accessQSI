const prisma = require("../prisma/client");
const {
  getPlanByKey,
  PLAN_KEYS,
  BILLING_INTERVALS
} = require("../config/subscription");

exports.findByEmail = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return prisma.userQ.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } }
  });
};

exports.createOrgAndAdminUser = async (orgData, userData) => {
  return await prisma.$transaction(async (tx) => {
    const freePlan = await getPlanByKey(tx, PLAN_KEYS.DISCOVERY);
    if (!freePlan) {
      throw new Error("Le plan Découverte est indisponible.");
    }

    const startedAt = new Date();

    const org = await tx.organization.create({
      data: {
        ...orgData,
        subscription_plan: freePlan.plan_id,
        subscription_started_at: startedAt,
        subscription_interval: BILLING_INTERVALS.MONTHLY
      }
    });

    const user = await tx.userQ.create({
      data: {
        ...userData,
        org_id: org.org_id
      }
    });

    await tx.subscription.create({
      data: {
        org_id: org.org_id,
        plan_id: freePlan.plan_id,
        status: "ACTIVE",
        billing_interval: BILLING_INTERVALS.MONTHLY,
        current_period_start: startedAt
      }
    });

    await tx.subscriptionAuditLog.create({
      data: {
        org_id: org.org_id,
        actor_user_id: user.user_id,
        action: "SIGNUP_FREE_PLAN_STARTED",
        after_snapshot: { plan: PLAN_KEYS.DISCOVERY, startsAt: startedAt }
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
