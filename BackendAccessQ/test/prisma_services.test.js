const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSrcModules, mockModule } = require("./helpers/http");

const loadService = (servicePath, prisma) => {
    clearSrcModules();
    mockModule("src/prisma/client", prisma);
    return require(servicePath);
};

test("area service filters and soft-deletes areas instead of hard deleting them", async () => {
    const calls = [];
    const areaService = loadService("../src/services/area.service", {
        area: {
            findMany: async (args) => {
                calls.push(["findMany", args]);
                return [];
            },
            update: async (args) => {
                calls.push(["update", args]);
                return { area_id: args.where.area_id, deleted_at: args.data.deleted_at };
            }
        }
    });

    await areaService.findAll(42);
    const deleted = await areaService.deleteArea(7);

    assert.deepEqual(calls[0], ["findMany", {
        where: { org_id: 42, deleted_at: null },
        orderBy: { area_name: "asc" }
    }]);
    assert.equal(calls[1][0], "update");
    assert.deepEqual(calls[1][1].where, { area_id: 7 });
    assert.equal(deleted.area_id, 7);
    assert.ok(deleted.deleted_at instanceof Date);
});

test("agent service soft-deletes agents to preserve scan logs", async () => {
    let updateArgs = null;
    const agentService = loadService("../src/services/agent.service", {
        userQ: {
            update: async (args) => {
                updateArgs = args;
                return { user_id: args.where.user_id, deleted_at: args.data.deleted_at };
            }
        }
    });

    const deleted = await agentService.softDeleteAgent(12, 42);

    assert.deepEqual(updateArgs.where, { user_id: 12 });
    assert.ok(updateArgs.data.deleted_at instanceof Date);
    assert.equal(deleted.user_id, 12);
});

test("agent service only counts scans belonging to the displayed organization", async () => {
    let findArgs = null;
    const agentService = loadService("../src/services/agent.service", {
        userQ: {
            findMany: async (args) => {
                findArgs = args;
                return [];
            }
        }
    });

    await agentService.getAllAgentsForOrg(42);

    assert.equal(findArgs.where.org_id, 42);
    assert.equal(
        findArgs.include._count.select.scan_logs.where.qr_code.event.org_id,
        42
    );
});

test("event service only includes active areas from the displayed organization", async () => {
    let findArgs = null;
    const eventService = loadService("../src/services/event.service", {
        event: {
            findMany: async (args) => {
                findArgs = args;
                return [];
            }
        }
    });

    await eventService.findAll(42);

    assert.equal(findArgs.where.org_id, 42);
    assert.deepEqual(findArgs.include.EventSchedules.where, {
        area: { org_id: 42, deleted_at: null }
    });
});

test("event service rejects schedules that reference areas outside the organization", async () => {
    const eventService = loadService("../src/services/event.service", {
        $transaction: async (callback) => callback({
            area: {
                count: async () => 0
            },
            event: {
                create: async () => {
                    throw new Error("event.create should not be called");
                }
            }
        })
    });

    await assert.rejects(
        eventService.createEvent({
            title: "Concert",
            org_id: 42,
            areaIds: [99],
            start_date: new Date("2026-01-01T10:00:00Z"),
            end_date: new Date("2026-01-01T22:00:00Z")
        }),
        (error) => error.code === "INVALID_EVENT_AREAS"
    );
});

test("event service updates schedules and event data in one transaction", async () => {
    const calls = [];
    const eventService = loadService("../src/services/event.service", {
        $transaction: async (callback) => callback({
            area: {
                count: async (args) => {
                    calls.push(["area.count", args]);
                    return 2;
                }
            },
            eventSchedule: {
                findFirst: async (args) => {
                    calls.push(["schedule.findFirst", args]);
                    return {
                        start_date: new Date("2026-01-01T10:00:00Z"),
                        end_date: new Date("2026-01-01T22:00:00Z")
                    };
                },
                deleteMany: async (args) => {
                    calls.push(["schedule.deleteMany", args]);
                },
                createMany: async (args) => {
                    calls.push(["schedule.createMany", args]);
                }
            },
            event: {
                update: async (args) => {
                    calls.push(["event.update", args]);
                    return { event_id: args.where.event_id, ...args.data };
                }
            }
        })
    });

    const updated = await eventService.updateEvent(5, {
        title: "Updated",
        areaIds: [2, 3],
        start_date: new Date("2026-02-01T10:00:00Z"),
        end_date: new Date("2026-02-01T22:00:00Z")
    }, 42);

    assert.equal(updated.event_id, 5);
    assert.deepEqual(calls.map(([name]) => name), [
        "area.count",
        "schedule.findFirst",
        "schedule.deleteMany",
        "schedule.createMany",
        "event.update"
    ]);
    assert.deepEqual(calls[0][1].where, {
        org_id: 42,
        area_id: { in: [2, 3] },
        deleted_at: null
    });
});

test("event service soft-deletes an event and revokes its QR codes together", async () => {
    const calls = [];
    const eventService = loadService("../src/services/event.service", {
        $transaction: async (callback) => callback({
            event: {
                update: async (args) => {
                    calls.push(["event.update", args]);
                    return { event_id: args.where.event_id, deleted_at: args.data.deleted_at };
                }
            },
            qrCode: {
                findMany: async (args) => {
                    calls.push(["qrCode.findMany", args]);
                    return [{ unique_token: "token-1" }];
                },
                updateMany: async (args) => {
                    calls.push(["qrCode.updateMany", args]);
                }
            }
        })
    });

    const deleted = await eventService.deleteEvent(5);

    assert.equal(deleted.event_id, 5);
    assert.deepEqual(calls.map(([name]) => name), ["qrCode.findMany", "event.update", "qrCode.updateMany"]);
    assert.deepEqual(calls[2][1].where, { event_id: 5, deleted_at: null });
    assert.equal(calls[2][1].data.status, "revoked");
    assert.ok(calls[2][1].data.deleted_at instanceof Date);
    assert.deepEqual(deleted.qr_tokens, ["token-1"]);
});

test("QR verification locks, evaluates, logs and consumes a scan in one transaction", async () => {
    const calls = [];
    const qr = {
        qr_id: 8,
        event_id: 5,
        unique_token: "token-8",
        status: "active",
        usage_limit: 1,
        scans_count: 0,
        valid_from: null,
        valid_until: null,
        deleted_at: null,
        level: 1,
        event: {
            org_id: 42,
            deleted_at: null,
            organization: { deleted_at: null, is_active: true },
            EventSchedules: [{
                id_area: 4,
                start_date: new Date("2026-01-01T10:00:00Z"),
                end_date: new Date("2026-01-01T18:00:00Z"),
                area: { accreditation_level: 1 }
            }]
        }
    };
    const qrVerifyService = loadService("../src/services/qr_verify.service", {
        $transaction: async (callback) => callback({
            $queryRawUnsafe: async (...args) => {
                calls.push(["lock", ...args]);
                return [{ qr_id: 8 }];
            },
            qrCode: {
                findUnique: async () => {
                    calls.push(["find"]);
                    return qr;
                },
                update: async ({ data }) => {
                    calls.push(["update", data]);
                    return {};
                }
            },
            scanLog: {
                create: async ({ data }) => {
                    calls.push(["scan", data]);
                    return { id: 1, ...data };
                }
            }
        })
    });

    const result = await qrVerifyService.verifyAndRecordScan({
        token: "token-8",
        scannerId: 12,
        scannerOrgId: 42,
        areaId: 4,
        location: { latitude: -11.66, longitude: 27.47 },
        now: new Date("2026-01-01T12:00:00Z")
    });

    assert.equal(result.decision.success, true);
    assert.deepEqual(calls.map(([name]) => name), ["lock", "find", "scan", "update"]);
    assert.equal(calls[2][1].area_id, 4);
    assert.equal(calls[2][1].location_lat, -11.66);
    assert.deepEqual(calls[3][1], { scans_count: 1, status: "used_up" });
});

test("QR service paginates organization results and applies server-side filters", async () => {
    let findArgs = null;
    const qrService = loadService("../src/services/qr.service", {
        qrCode: {
            findMany: async (args) => {
                findArgs = args;
                return [{ qr_id: 1 }];
            },
            count: async () => 51
        },
        $transaction: async (operations) => Promise.all(operations)
    });

    const result = await qrService.getAllQrsForOrg(42, {
        page: 2,
        pageSize: 25,
        search: "Jane",
        status: "active"
    });

    assert.equal(findArgs.skip, 25);
    assert.equal(findArgs.take, 25);
    assert.equal(findArgs.where.event.org_id, 42);
    assert.equal(result.pagination.total, 51);
    assert.equal(result.pagination.totalPages, 3);
});
