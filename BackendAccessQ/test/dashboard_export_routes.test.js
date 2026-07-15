const test = require("node:test");
const assert = require("node:assert/strict");
const {
    authAs,
    clearSrcModules,
    mockModule,
    mockPackage,
    mountRouter,
    request
} = require("./helpers/http");

const loadDashboardApp = ({ user, prisma }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/prisma/client", prisma);

    const router = require("../src/routes/dashboard.routes");
    return mountRouter("/dashboard", router);
};

const loadExportApp = ({ user, prisma, csvWriter, PDFDocument }) => {
    clearSrcModules();
    mockModule("src/middleware/authMiddleware", authAs(user));
    mockModule("src/prisma/client", prisma);
    mockPackage("csv-writer", {
        createObjectCsvWriter: () => csvWriter
    });
    mockPackage("pdfkit", PDFDocument);

    const router = require("../src/routes/export.routes");
    return mountRouter("/export", router);
};

test("GET /dashboard/stats returns overview stats scoped to the authenticated organization", async () => {
    const calls = [];
    const prisma = {
        area: { count: async ({ where }) => { calls.push(["area.count", where.org_id]); return 1; } },
        cardTemplateCustom: { count: async ({ where }) => { calls.push(["cardTemplate.count", where.org_id]); return 1; } },
        qrCode: {
            count: async ({ where }) => {
                calls.push(["qrCode.count", where.event.org_id]);
                return 4;
            },
            aggregate: async ({ where }) => {
                calls.push(["qrCode.aggregate", where.event.org_id]);
                return { _sum: { scans_count: 12 } };
            }
        },
        event: {
            count: async ({ where }) => {
                calls.push(["event.count", where.org_id]);
                return 2;
            }
        },
        eventSchedule: {
            findFirst: async ({ where }) => {
                calls.push(["eventSchedule.findFirst", where.event.org_id]);
                return { event: { title: "Next Event" } };
            }
        },
        userQ: {
            count: async ({ where }) => {
                calls.push(["userQ.count", where.org_id]);
                return 3;
            },
            findUnique: async ({ where }) => ({ full_name: `Agent ${where.user_id}` })
        },
        scanLog: {
            count: async ({ where }) => {
                calls.push(["scanLog.count", where.qr_code.event.org_id]);
                return 1;
            },
            groupBy: async ({ where }) => {
                calls.push(["scanLog.groupBy", where.qr_code.event.org_id]);
                return [{ scanned_by_id: 7, _count: { id: 5 } }];
            },
            findMany: async ({ where }) => {
                calls.push(["scanLog.findMany", where.qr_code.event.org_id]);
                return [{
                    id: 1,
                    scanned_at: new Date("2026-01-01T10:00:00Z"),
                    status: "authorized",
                    qr_code: { unique_token: "abcdef123456", event: { title: "Concert" } },
                    scanned_by: { full_name: "Alice" }
                }];
            }
        }
    };
    const app = loadDashboardApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        prisma
    });

    const res = await request(app, "GET", "/dashboard/stats");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.activeQrs, 4);
    assert.equal(res.body.data.totalScans, 12);
    assert.equal(res.body.data.nextEventTitle, "Next Event");
    assert.equal(res.body.data.scansByDay.length, 7);
    assert.equal(res.body.data.topAgents[0].name, "Agent 7");
    assert.ok(calls.every(([, orgId]) => orgId === 42));
});

test("GET /dashboard/stats tolerates missing dashboard relations", async () => {
    const prisma = {
        area: { count: async () => 0 },
        cardTemplateCustom: { count: async () => 0 },
        qrCode: {
            count: async () => 1,
            aggregate: async () => ({ _sum: { scans_count: 1 } })
        },
        event: {
            count: async () => 0
        },
        eventSchedule: {
            findFirst: async () => null
        },
        userQ: {
            count: async () => 0,
            findUnique: async () => null
        },
        scanLog: {
            count: async () => 0,
            groupBy: async () => [{ scanned_by_id: 99, _count: { id: 1 } }],
            findMany: async () => [{
                id: 1,
                scanned_at: new Date("2026-01-01T10:00:00Z"),
                status: "authorized",
                qr_code: null,
                scanned_by: null
            }]
        }
    };
    const app = loadDashboardApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        prisma
    });

    const res = await request(app, "GET", "/dashboard/stats");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.topAgents[0].name, "Agent inconnu");
    assert.equal(res.body.data.recentScans[0].code, "N/A");
    assert.equal(res.body.data.recentScans[0].event, "Événement inconnu");
    assert.equal(res.body.data.recentScans[0].agent, "Agent inconnu");
});

test("GET /dashboard/stats rejects users without an organization", async () => {
    const app = loadDashboardApp({
        user: { user_id: 7, role: "SUPER_ADMIN", org_id: null },
        prisma: {}
    });

    const res = await request(app, "GET", "/dashboard/stats");

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
});

test("GET /export/csv exports scans scoped by organization and optional event", async () => {
    let whereClause = null;
    let recordsWritten = null;
    const app = loadExportApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        prisma: {
            qrCode: {
                findMany: async ({ where }) => {
                    whereClause = where;
                    return [{
                        qr_id: 9,
                        unique_token: "token-1",
                        holder_name: "Jane",
                        holder_email: "jane@example.com",
                        holder_phone: "+243000000",
                        scans_count: 1,
                        usage_limit: 2,
                        status: "authorized",
                        event: { title: "Concert" },
                        scan_logs: [{
                            scanned_at: new Date("2026-01-01T10:00:00Z"),
                            status: "authorized",
                            location_lat: "-11.664",
                            location_long: "27.479",
                            scanned_by: { full_name: "Alice" }
                        }]
                    }, {
                        qr_id: 10,
                        unique_token: "token-2",
                        holder_name: "Bob",
                        holder_email: null,
                        holder_phone: null,
                        scans_count: 0,
                        usage_limit: 1,
                        status: "active",
                        event: { title: "Concert" },
                        scan_logs: []
                    }];
                }
            }
        },
        csvWriter: {
            writeRecords: async (records) => {
                recordsWritten = records;
            }
        },
        PDFDocument: function PDFDocument() {}
    });

    const res = await request(app, "GET", "/export/csv?event_id=5");

    assert.equal(res.status, 200);
    assert.equal(whereClause.event.org_id, 42);
    assert.equal(whereClause.event_id, 5);
    assert.equal(recordsWritten.length, 2);
    assert.equal(recordsWritten[0].token, "token-1");
    assert.equal(recordsWritten[0].scansCount, 1);
    assert.equal(recordsWritten[0].result, "AUTORISÉ");
    assert.equal(recordsWritten[0].agent, "Alice");
    assert.equal(recordsWritten[0].latitude, "-11.664");
    assert.equal(recordsWritten[1].token, "token-2");
    assert.equal(recordsWritten[1].result, "AUCUN SCAN");
    assert.equal(res.body.downloaded, true);
    assert.equal(res.body.filename, "scans_history.csv");
});

test("GET /export/pdf streams a PDF response for authenticated users", async () => {
    let whereClause = null;
    class FakePDFDocument {
        pipe(res) {
            this.res = res;
        }
        fontSize() { return this; }
        text() { return this; }
        moveDown() { return this; }
        font() { return this; }
        addPage() { return this; }
        end() {
            this.res.end("PDF");
        }
    }

    const app = loadExportApp({
        user: { user_id: 7, role: "ORG_ADMIN", org_id: 42 },
        prisma: {
            scanLog: {
                findMany: async ({ where }) => {
                    whereClause = where;
                    return [{
                        scanned_at: new Date("2026-01-01T10:00:00Z"),
                        qr_code: { holder_name: "Jane", event: { title: "Concert" } },
                        scanned_by: { full_name: "Alice" }
                    }];
                }
            }
        },
        csvWriter: { writeRecords: async () => {} },
        PDFDocument: FakePDFDocument
    });

    const res = await request(app, "GET", "/export/pdf");

    assert.equal(res.status, 200);
    assert.equal(whereClause.qr_code.event.org_id, 42);
    assert.equal(res.body, "PDF");
});
