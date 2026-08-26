const prisma = require("../prisma/client");
const {
  addUtcMonths,
  getPlanByKey,
  PLAN_DETAILS,
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
    const essentialPlan = await getPlanByKey(tx, PLAN_KEYS.ESSENTIAL);
    if (!essentialPlan) {
      throw new Error("Le plan Essentiel est indisponible.");
    }

    const trialStartedAt = new Date();
    const trialExpiresAt = addUtcMonths(trialStartedAt, 1);

    const org = await tx.organization.create({
      data: {
        ...orgData,
        subscription_plan: essentialPlan.plan_id,
        subscription_started_at: trialStartedAt,
        subscription_expires_at: trialExpiresAt,
        subscription_interval: BILLING_INTERVALS.MONTHLY,
        trial_started_at: trialStartedAt,
        trial_expires_at: trialExpiresAt
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
        plan_id: essentialPlan.plan_id,
        status: "TRIALING",
        billing_interval: BILLING_INTERVALS.MONTHLY,
        current_period_start: trialStartedAt,
        current_period_end: trialExpiresAt
      }
    });

    await tx.subscriptionPeriod.create({
      data: {
        org_id: org.org_id,
        plan_id: essentialPlan.plan_id,
        billing_interval: BILLING_INTERVALS.MONTHLY,
        starts_at: trialStartedAt,
        ends_at: trialExpiresAt,
        source: "SIGNUP_ESSENTIAL_TRIAL",
        entitlement_snapshot: {
          plan: PLAN_KEYS.ESSENTIAL,
          limits: {
            maxEventsPerCycle: PLAN_DETAILS.ESSENTIAL.maxEventsPerCycle,
            maxQrCodesPerEvent: PLAN_DETAILS.ESSENTIAL.maxQrCodesPerEvent,
            maxAgents: PLAN_DETAILS.ESSENTIAL.maxAgents,
            maxAreas: PLAN_DETAILS.ESSENTIAL.maxAreas
          },
          capabilities: [...PLAN_DETAILS.ESSENTIAL.capabilities]
        }
      }
    });

    await tx.subscriptionAuditLog.create({
      data: {
        org_id: org.org_id,
        actor_user_id: user.user_id,
        action: "SIGNUP_ESSENTIAL_TRIAL_STARTED",
        after_snapshot: {
          plan: PLAN_KEYS.ESSENTIAL,
          startsAt: trialStartedAt,
          expiresAt: trialExpiresAt
        }
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
