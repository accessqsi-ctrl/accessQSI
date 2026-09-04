const test = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../src/prisma/client");
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
} = require("../src/config/subscription");
const requireProPlan = require("../src/middleware/planAccessMiddleware");

const makeResponse = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; }
});

test("Découverte applique 1 événement mensuel, 50 QR par événement, 2 agents et 2 zones", () => {
  const summary = getPlanSummary({ plan: { title: "DISCOVERY" }, created_at: new Date("2026-01-08T10:00:00Z") });
  assert.equal(summary.plan, "DISCOVERY");
  assert.equal(getEventQuotaStatus(summary, 1).allowed, false);
  assert.equal(getQrQuotaStatus(summary, 50).allowed, false);
  assert.equal(getAgentQuotaStatus(summary, 2).allowed, false);
  assert.equal(getAreaQuotaStatus(summary, 2).allowed, false);
});

test("Essential applique 5 événements, 200 QR, 5 agents et 6 zones", () => {
  const summary = getPlanSummary({ plan: { title: "ESSENTIAL" } });
  assert.deepEqual(summary.limits, {
    maxEvents: 5,
    maxEventsPerCycle: 5,
    maxQrCodes: 200,
    maxQrCodesPerEvent: 200,
    maxAgents: 5,
    maxAreas: 6,
    maxPdfPagesPerFile: 200
  });
  assert.equal(hasPlanCapability(summary, PLAN_CAPABILITIES.SCAN_EXPORTS), true);
  assert.equal(hasPlanCapability(summary, PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES), false);
});

test("Essential est identifié comme un essai pendant sa période gratuite", () => {
  const now = new Date("2026-08-26T10:00:00Z");
  const summary = getPlanSummary({
    plan: { title: "ESSENTIAL" },
    subscription_started_at: new Date("2026-08-01T10:00:00Z"),
    subscription_expires_at: new Date("2026-09-01T10:00:00Z"),
    trial_started_at: new Date("2026-08-01T10:00:00Z"),
    trial_expires_at: new Date("2026-09-01T10:00:00Z")
  }, now);

  assert.equal(summary.plan, "ESSENTIAL");
  assert.equal(summary.isTrial, true);
  assert.equal(summary.subscriptionType, "TRIAL");
});

test("Pro applique 7 événements, 500 QR, 10 agents et 15 zones", () => {
  const summary = getPlanSummary({ plan: { title: "PRO" } });
  assert.equal(getEventQuotaStatus(summary, 6).allowed, true);
  assert.equal(getEventQuotaStatus(summary, 7).allowed, false);
  assert.equal(getQrQuotaStatus(summary, 499).allowed, true);
  assert.equal(getQrQuotaStatus(summary, 500).allowed, false);
  assert.equal(summary.limits.maxAgents, 10);
  assert.equal(summary.limits.maxAreas, 15);
  assert.equal(hasPlanCapability(summary, PLAN_CAPABILITIES.ADVANCED_ANALYTICS), true);
});

test("Entreprise est administrable sur devis avec les capacités avancées", () => {
  const summary = getPlanSummary({ plan: { title: "ENTERPRISE" } });
  assert.equal(summary.plan, "ENTERPRISE");
  assert.equal(summary.isPaid, true);
  assert.equal(summary.isPro, true);
  assert.equal(summary.limits.maxEventsPerCycle, null);
  assert.equal(summary.limits.maxQrCodesPerEvent, null);
  assert.equal(hasPlanCapability(summary, PLAN_CAPABILITIES.ADVANCED_ANALYTICS), true);
});

test("Entreprise applique les limites négociées du contrat", () => {
  const summary = getPlanSummary({
    plan: { title: "ENTERPRISE" },
    enterprise_entitlements: {
      maxEventsPerCycle: 80,
      maxQrCodesPerEvent: 4000,
      maxAgents: 35,
      maxAreas: 50,
      capabilities: ["scan_exports", "advanced_analytics"]
    }
  });
  assert.equal(summary.limits.maxEventsPerCycle, 80);
  assert.equal(summary.limits.maxQrCodesPerEvent, 4000);
  assert.equal(summary.limits.maxAgents, 35);
  assert.equal(summary.limits.maxAreas, 50);
  assert.deepEqual(summary.capabilities, ["scan_exports", "advanced_analytics"]);
});

test("un abonnement expiré revient aux avantages Découverte", () => {
  const summary = getPlanSummary({
    plan: { title: "PRO" },
    subscription_expires_at: new Date(Date.now() - 1000)
  });
  assert.equal(summary.plan, "DISCOVERY");
  assert.equal(summary.downgraded, true);
  assert.equal(summary.limits.maxEventsPerCycle, 1);
  assert.equal(summary.limits.maxQrCodesPerEvent, 50);
});

test("le cycle mensuel utilise des périodes fixes de 30 jours même en facturation annuelle", () => {
  const summary = getPlanSummary({
    plan: { title: "ESSENTIAL" },
    subscription_interval: "ANNUAL",
    subscription_started_at: new Date("2026-01-31T10:00:00Z"),
    subscription_expires_at: new Date("2027-01-26T10:00:00Z")
  }, new Date("2026-03-15T10:00:00Z"));
  assert.equal(summary.cycleStartedAt.toISOString(), "2026-03-02T10:00:00.000Z");
  assert.equal(summary.cycleEndsAt.toISOString(), "2026-04-01T10:00:00.000Z");
});

test("le profil de consommation calcule le restant de chaque quota", () => {
  const summary = getPlanSummary({ plan: { title: "ESSENTIAL" } });
  const usage = getPlanUsage(summary, { events: 2, qrCodes: 75, agents: 4, areas: 1 });
  assert.deepEqual(usage.events, { used: 2, limit: 5, remaining: 3, reached: false });
  assert.deepEqual(usage.qrCodes, { used: 75, limit: 200, remaining: 125, reached: false });
  assert.deepEqual(usage.agents, { used: 4, limit: 5, remaining: 1, reached: false });
  assert.deepEqual(usage.areas, { used: 1, limit: 6, remaining: 5, reached: false });
});

test("une organisation peut passer de Découverte à Pro puis revenir à Découverte", async () => {
  const plans = new Map();
  let nextId = 1;
  const organization = { org_id: 42, subscription_plan: null };
  const prismaClient = {
    plan: {
      upsert: async ({ create, update }) => {
        const current = plans.get(create.title);
        const saved = current ? { ...current, ...update } : { plan_id: nextId++, ...create };
        plans.set(create.title, saved);
        return saved;
      },
      findMany: async () => [...plans.values()],
      findUnique: async ({ where }) => plans.get(where.title) || null
    },
    organization: { update: async ({ data }) => Object.assign(organization, data) }
  };
  await assignOrganizationPlan(prismaClient, organization.org_id, "DISCOVERY");
  await assignOrganizationPlan(prismaClient, organization.org_id, "PRO");
  let current = [...plans.values()].find((item) => item.plan_id === organization.subscription_plan);
  assert.equal(getPlanSummary({ plan: current }).plan, "PRO");
  await assignOrganizationPlan(prismaClient, organization.org_id, "DISCOVERY");
  current = [...plans.values()].find((item) => item.plan_id === organization.subscription_plan);
  assert.equal(getPlanSummary({ plan: current }).plan, "DISCOVERY");
});

test("le middleware Pro refuse Découverte et autorise Pro", async (t) => {
  const originalFindUnique = prisma.organization.findUnique;
  t.after(() => { prisma.organization.findUnique = originalFindUnique; });
  const discoveryResponse = makeResponse();
  prisma.organization.findUnique = async () => ({ plan: { title: "DISCOVERY" } });
  await requireProPlan()({ user: { org_id: 10 } }, discoveryResponse, () => {});
  assert.equal(discoveryResponse.statusCode, 403);
  const proResponse = makeResponse();
  let nextCalled = false;
  prisma.organization.findUnique = async () => ({ plan: { title: "PRO" } });
  await requireProPlan()({ user: { org_id: 11 } }, proResponse, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
