const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");

const loadService = ({ failIdempotencyWrite = false } = {}) => {
    clearSrcModules();
    const state = {
        qrs: [],
        requests: new Map(),
        templateLookups: [],
        customTemplateAvailable: true
    };
    let nextQrId = 1;
    let transactionTail = Promise.resolve();

    const requestKey = ({ org_id, scope, idempotency_key_hash }) => (
        `${org_id}:${scope}:${idempotency_key_hash}`
    );
    const tx = {
        passIssuanceRequest: {
            findUnique: async ({ where }) => {
                const key = requestKey(where.org_id_scope_idempotency_key_hash);
                const request = state.requests.get(key);
                if (!request) return null;
                return {
                    ...request,
                    qr_code: state.qrs.find(qr => qr.qr_id === request.qr_id)
                };
            },
            create: async ({ data }) => {
                if (failIdempotencyWrite) throw new Error("idempotency write failed");
                const key = requestKey(data);
                if (state.requests.has(key)) {
                    const error = new Error("duplicate");
                    error.code = "P2002";
                    throw error;
                }
                state.requests.set(key, { ...data });
                return data;
            }
        }
    };

    mockModule("src/services/event.service", {
        findById: async (orgId, eventId) => (
            orgId === 42 && eventId === 5
                ? { event_id: 5, org_id: 42, title: "Concert" }
                : null
        )
    });
    mockModule("src/services/qr.service", {
        createQr: async (data, dbClient) => {
            assert.equal(dbClient, tx);
            const qr = { qr_id: nextQrId++, ...data };
            state.qrs.push(qr);
            return qr;
        },
        findPassIssuanceRequest: async (orgId, scope, idempotencyKeyHash, dbClient = tx) => (
            dbClient.passIssuanceRequest.findUnique({
                where: {
                    org_id_scope_idempotency_key_hash: {
                        org_id: orgId,
                        scope,
                        idempotency_key_hash: idempotencyKeyHash
                    }
                },
                include: { qr_code: true }
            })
        )
    });
    mockModule("src/services/card_template.service", {
        isTemplateAvailable: templateId => templateId === "event-ticket",
        extractCustomTemplateId: templateId => String(templateId).startsWith("custom:")
            ? Number(String(templateId).slice(7))
            : null
    });
    mockModule("src/services/custom_card_template.service", {
        getDefaultForOrg: async () => "",
        resolveCustomForRender: async (orgId, templateId) => {
            state.templateLookups.push({ orgId, templateId });
            if (!state.customTemplateAvailable || orgId !== 42 || templateId !== "custom:7") return null;
            return {
                baseTemplateId: "event-ticket",
                customization: { title: "VIP", primaryColor: "#123456" }
            };
        }
    });
    mockModule("src/utils/planAccess", {
        getOrganizationPlanContext: async () => ({
            plan: "PRO",
            planName: "Pro",
            capabilities: ["custom_card_templates"]
        })
    });
    mockModule("src/services/organization_quota.service", {
        withEventQrQuota: async ({ resolveExisting, create }) => {
            const previous = transactionTail;
            let release;
            transactionTail = new Promise(resolve => { release = resolve; });
            await previous;
            const qrsSnapshot = state.qrs.slice();
            const requestsSnapshot = new Map(state.requests);
            const nextQrSnapshot = nextQrId;
            try {
                const existing = resolveExisting ? await resolveExisting(tx, {}) : null;
                return existing || await create(tx, {});
            } catch (error) {
                state.qrs.splice(0, state.qrs.length, ...qrsSnapshot);
                state.requests = requestsSnapshot;
                nextQrId = nextQrSnapshot;
                throw error;
            } finally {
                release();
            }
        }
    });

    return {
        service: require("../src/services/pass_issuance.service"),
        state
    };
};

const baseInput = () => ({
    fullName: "Jane Holder",
    email: "JANE@example.com",
    phone: "+243000000000",
    accessType: "multi",
    limit: 3,
    level: 2,
    validFrom: "2026-11-01T08:00:00.000Z",
    validUntil: "2026-11-01T20:00:00.000Z",
    cardTemplateId: "custom:7",
    cardMessage: "Accès VIP",
    cardData: { zone: "Salon" }
});

test("issuePass creates the complete QR and template snapshot atomically", async () => {
    const { service, state } = loadService();
    const result = await service.issuePass({
        organizationId: 42,
        eventId: 5,
        input: baseInput()
    });

    assert.equal(result.replayed, false);
    assert.equal(state.qrs.length, 1);
    assert.equal(result.qrRecord.holder_email, "jane@example.com");
    assert.equal(result.qrRecord.usage_limit, 3);
    assert.equal(result.qrRecord.level, 2);
    assert.equal(result.qrRecord.card_generation_status, "ON_DEMAND");
    assert.equal(result.qrRecord.card_template_snapshot.sourceTemplateId, "custom:7");
    assert.equal(result.qrRecord.card_template_snapshot.customization.customization.title, "VIP");
    assert.match(result.qrRecord.unique_token, /^[0-9a-f-]{36}$/);
});

test("issuePass refuses events and custom templates outside the organization", async () => {
    const { service } = loadService();
    await assert.rejects(
        service.issuePass({ organizationId: 99, eventId: 5, input: baseInput() }),
        error => error.code === "EVENT_NOT_FOUND"
    );
    await assert.rejects(
        service.issuePass({
            organizationId: 42,
            eventId: 5,
            input: { ...baseInput(), cardTemplateId: "custom:99" }
        }),
        error => error.code === "INVALID_CARD_TEMPLATE"
    );
});

test("concurrent calls with the same idempotency key return one pass", async () => {
    const { service, state } = loadService();
    const command = {
        organizationId: 42,
        eventId: 5,
        input: baseInput(),
        idempotency: { scope: "registration:123", key: "same-key" }
    };

    const [first, second] = await Promise.all([
        service.issuePass(command),
        service.issuePass(command)
    ]);

    assert.equal(state.qrs.length, 1);
    assert.equal(state.requests.size, 1);
    assert.equal(first.qrRecord.qr_id, second.qrRecord.qr_id);
    assert.deepEqual([first.replayed, second.replayed].sort(), [false, true]);
});

test("reusing an idempotency key with different effective data is a conflict", async () => {
    const { service, state } = loadService();
    const idempotency = { scope: "registration:123", key: "same-key" };
    await service.issuePass({ organizationId: 42, eventId: 5, input: baseInput(), idempotency });

    await assert.rejects(
        service.issuePass({
            organizationId: 42,
            eventId: 5,
            input: { ...baseInput(), level: 3 },
            idempotency
        }),
        error => error.code === "IDEMPOTENCY_KEY_CONFLICT" && error.statusCode === 409
    );
    assert.equal(state.qrs.length, 1);
});

test("an idempotent replay still returns its pass after the selected template is unavailable", async () => {
    const { service, state } = loadService();
    const command = {
        organizationId: 42,
        eventId: 5,
        input: baseInput(),
        idempotency: { scope: "registration:123", key: "durable-key" }
    };
    const first = await service.issuePass(command);
    state.customTemplateAvailable = false;

    const replay = await service.issuePass(command);

    assert.equal(replay.replayed, true);
    assert.equal(replay.qrRecord.qr_id, first.qrRecord.qr_id);
    assert.equal(state.qrs.length, 1);
});

test("the same holder can receive multiple legitimate passes without a key", async () => {
    const { service, state } = loadService();
    const first = await service.issuePass({ organizationId: 42, eventId: 5, input: baseInput() });
    const second = await service.issuePass({ organizationId: 42, eventId: 5, input: baseInput() });

    assert.equal(state.qrs.length, 2);
    assert.notEqual(first.qrRecord.qr_id, second.qrRecord.qr_id);
    assert.notEqual(first.qrRecord.unique_token, second.qrRecord.unique_token);
});

test("an idempotency persistence failure rolls the QR creation back", async () => {
    const { service, state } = loadService({ failIdempotencyWrite: true });
    await assert.rejects(
        service.issuePass({
            organizationId: 42,
            eventId: 5,
            input: baseInput(),
            idempotency: { scope: "registration:123", key: "failing-key" }
        }),
        /idempotency write failed/
    );
    assert.equal(state.qrs.length, 0);
    assert.equal(state.requests.size, 0);
});
