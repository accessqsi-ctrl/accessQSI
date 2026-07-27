const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/prisma/client');
const {
  PLAN_CAPABILITIES,
  getPlanSummary,
  getQrQuotaStatus,
  getEventQuotaStatus,
  getAgentQuotaStatus,
  getAreaQuotaStatus,
  getPlanUsage,
  hasPlanCapability,
  assignOrganizationPlan
} = require('../src/config/subscription');
const requireProPlan = require('../src/middleware/planAccessMiddleware');

const makeResponse = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  return res;
};

test('un plan Free avec 100 QR existants refuse une nouvelle génération', () => {
  const summary = getPlanSummary({ plan: { title: 'FREE' } });
  const quota = getQrQuotaStatus(summary, 100);

  assert.equal(summary.plan, 'FREE');
  assert.equal(quota.allowed, false);
  assert.equal(quota.remaining, 0);
  assert.equal(quota.limit, 100);
});

test('un plan Pro autorise une génération illimitée', () => {
  const summary = getPlanSummary({ plan: { title: 'PRO' } });
  const quota = getQrQuotaStatus(summary, 1000);

  assert.equal(summary.plan, 'PRO');
  assert.equal(quota.allowed, true);
  assert.equal(quota.remaining, null);
  assert.equal(quota.limit, null);
});

test('un plan Free refuse aussi la création d\'événements au-delà de sa limite', () => {
  const summary = getPlanSummary({ plan: { title: 'FREE' } });
  const quota = getEventQuotaStatus(summary, 3);

  assert.equal(summary.plan, 'FREE');
  assert.equal(quota.allowed, false);
  assert.equal(quota.remaining, 0);
  assert.equal(quota.limit, 3);
});

test('un plan Pro garde des limites d\'événements et de QR ouvertes', () => {
  const summary = getPlanSummary({ plan: { title: 'PRO' } });
  const qrQuota = getQrQuotaStatus(summary, 1000);
  const eventQuota = getEventQuotaStatus(summary, 30);

  assert.equal(summary.plan, 'PRO');
  assert.equal(qrQuota.allowed, true);
  assert.equal(qrQuota.limit, null);
  assert.equal(eventQuota.allowed, true);
  assert.equal(eventQuota.limit, null);
});

test('un plan Free limite les agents et les zones actifs à 4', () => {
  const summary = getPlanSummary({ plan: { title: 'FREE' } });
  const agentQuota = getAgentQuotaStatus(summary, 4);
  const areaQuota = getAreaQuotaStatus(summary, 4);

  assert.equal(summary.limits.maxAgents, 4);
  assert.equal(summary.limits.maxAreas, 4);
  assert.equal(agentQuota.allowed, false);
  assert.equal(agentQuota.remaining, 0);
  assert.equal(areaQuota.allowed, false);
  assert.equal(areaQuota.remaining, 0);
});

test('un plan Pro garde les agents et les zones illimités', () => {
  const summary = getPlanSummary({ plan: { title: 'PRO' } });

  assert.equal(getAgentQuotaStatus(summary, 50).allowed, true);
  assert.equal(getAgentQuotaStatus(summary, 50).limit, null);
  assert.equal(getAreaQuotaStatus(summary, 50).allowed, true);
  assert.equal(getAreaQuotaStatus(summary, 50).limit, null);
});

test('les capacités commerciales sont dérivées de la matrice centrale du plan', () => {
  const free = getPlanSummary({ plan: { title: 'FREE' } });
  const pro = getPlanSummary({ plan: { title: 'PRO' } });

  assert.equal(hasPlanCapability(free, PLAN_CAPABILITIES.ADVANCED_ANALYTICS), false);
  assert.equal(hasPlanCapability(pro, PLAN_CAPABILITIES.ADVANCED_ANALYTICS), true);
  assert.equal(hasPlanCapability(pro, PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES), true);
});

test('le profil de consommation calcule le restant pour chaque quota Free', () => {
  const summary = getPlanSummary({ plan: { title: 'FREE' } });
  const usage = getPlanUsage(summary, {
    events: 2,
    qrCodes: 75,
    agents: 4,
    areas: 1
  });

  assert.deepEqual(usage.events, { used: 2, limit: 3, remaining: 1, reached: false });
  assert.deepEqual(usage.qrCodes, { used: 75, limit: 100, remaining: 25, reached: false });
  assert.deepEqual(usage.agents, { used: 4, limit: 4, remaining: 0, reached: true });
  assert.deepEqual(usage.areas, { used: 1, limit: 4, remaining: 3, reached: false });
});

test('une organisation passe de Free à Pro puis revient à Free sans conserver les droits Pro', async () => {
  const plans = new Map([
    ['FREE', { plan_id: 1, title: 'FREE', cost: 0, features: [] }],
    ['PRO', {
      plan_id: 2,
      title: 'PRO',
      cost: 4900,
      features: Object.values(PLAN_CAPABILITIES)
    }]
  ]);
  const organization = { org_id: 42, subscription_plan: 1 };
  const prismaClient = {
    plan: {
      upsert: async ({ create, update }) => {
        const existing = plans.get(create.title);
        const saved = existing
          ? { ...existing, ...update }
          : { plan_id: plans.size + 1, ...create };
        plans.set(create.title, saved);
        return saved;
      },
      findMany: async () => [...plans.values()],
      findUnique: async ({ where }) => plans.get(where.title) || null
    },
    organization: {
      update: async ({ data }) => {
        organization.subscription_plan = data.subscription_plan;
        return organization;
      }
    }
  };
  const currentSummary = () => {
    const plan = [...plans.values()].find(item => item.plan_id === organization.subscription_plan);
    return getPlanSummary({ ...organization, plan });
  };

  assert.equal(currentSummary().plan, 'FREE');
  assert.equal(hasPlanCapability(currentSummary(), PLAN_CAPABILITIES.ADVANCED_ANALYTICS), false);

  await assignOrganizationPlan(prismaClient, organization.org_id, 'PRO');
  assert.equal(currentSummary().plan, 'PRO');
  assert.equal(currentSummary().limits.maxEvents, null);
  assert.equal(hasPlanCapability(currentSummary(), PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES), true);

  await assignOrganizationPlan(prismaClient, organization.org_id, 'FREE');
  const downgraded = currentSummary();
  assert.equal(downgraded.plan, 'FREE');
  assert.equal(downgraded.limits.maxEvents, 3);
  assert.equal(hasPlanCapability(downgraded, PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES), false);
  assert.equal(hasPlanCapability(downgraded, PLAN_CAPABILITIES.ADVANCED_ANALYTICS), false);
  assert.equal(getPlanUsage(downgraded, { events: 8 }).events.reached, true);
});

test('le middleware Pro refuse l\'accès d\'une organisation Free et autorise une organisation Pro', async (t) => {
  const originalFindUnique = prisma.organization.findUnique;
  t.after(() => {
    prisma.organization.findUnique = originalFindUnique;
  });

  const freeResponse = makeResponse();
  let freeNextCalled = false;
  prisma.organization.findUnique = async () => ({ plan: { title: 'FREE' } });

  await requireProPlan()( { user: { org_id: 10 } }, freeResponse, () => {
    freeNextCalled = true;
  });

  assert.equal(freeNextCalled, false);
  assert.equal(freeResponse.statusCode, 403);
  assert.equal(freeResponse.body.upgradeRequired, true);

  const proResponse = makeResponse();
  let proNextCalled = false;
  prisma.organization.findUnique = async () => ({ plan: { title: 'PRO' } });

  await requireProPlan()( { user: { org_id: 11 } }, proResponse, () => {
    proNextCalled = true;
  });

  assert.equal(proNextCalled, true);
  assert.equal(proResponse.statusCode, null);
});
