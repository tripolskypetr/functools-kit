import { test } from "worker-testbed";
import { Subject, Source, Operator, sleep } from "../../../build/index.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

const noUnhandled = (t) => process.on("unhandledRejection", (r) => t.fail("unhandled: " + r));

const throws = async (t, fn, expectedMsg) => {
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === expectedMsg) t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// throw in terminal subscriber — propagates back to next()
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: filter → map → map → toPromise, throw in map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(price => price > 100)
     .map(price => price * 0.9)
     .map(() => { throw new Error("format-error"); })
     .toPromise();
    await throws(t, () => s.next(200), "format-error");
});

test("chain-throw: mapAsync → distinct → take → connect, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.mapAsync(async () => { await sleep(5); throw new Error("enrich-fail"); })
     .operator(Operator.distinct(o => o.id))
     .operator(Operator.take(3))
     .toPromise();
    await throws(t, () => s.next(1), "enrich-fail");
});

test("chain-throw: skip → group → connect, throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.skip(1))
     .operator(Operator.group(2))
     .connect(() => { throw new Error("page-handler-error"); });
    await s.next("header"); // skipped
    await s.next("apple");  // item 1 — group not full yet
    await throws(t, () => s.next("banana"), "page-handler-error"); // item 2 — group emits
});

test("chain-throw: filter → pair → map → toPromise, throw in pair map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(p => p > 0)
     .operator(Operator.pair())
     .map(() => { throw new Error("delta-error"); })
     .toPromise();
    await s.next(100); // no pair yet
    await throws(t, () => s.next(105), "delta-error");
});

test("chain-throw: count → filter → map → toPromise, throw in final map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.count())
     .filter(({ count }) => count >= 2)
     .map(() => { throw new Error("streak-error"); })
     .toPromise();
    await s.next(20);
    await s.next(20);
    await throws(t, () => s.next(20), "streak-error");
});

test("chain-throw: skip → take → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.skip(2))
     .operator(Operator.take(3))
     .connect(async () => { await sleep(5); throw new Error("log-error"); });
    await s.next("boot1");
    await s.next("boot2");
    await throws(t, () => s.next("err1"), "log-error");
});

test("chain-throw: distinct → mapAsync → tap → toPromise, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.distinct())
     .mapAsync(async () => { await sleep(5); throw new Error("fetch-error"); })
     .tap(() => {})
     .toPromise();
    await throws(t, () => s.next(42), "fetch-error");
});

test("chain-throw: filter → retry → map → connect, async throw propagates through retry", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(tx => tx.amount > 0)
     .operator(Operator.retry(1))
     .connect(async () => { await sleep(5); throw new Error("tx-error"); });
    await throws(t, () => s.next({ amount: 50 }), "tx-error");
});

test("chain-throw: filter → pair → map → toPromise, throw in moving-avg map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => !isNaN(v))
     .operator(Operator.pair())
     .map(() => { throw new Error("avg-error"); })
     .toPromise();
    await s.next(10);
    await throws(t, () => s.next(20), "avg-error");
});

test("chain-throw: group → mapAsync → toPromise, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.group(3))
     .mapAsync(async () => { await sleep(5); throw new Error("batch-enrich-fail"); })
     .toPromise();
    await s.next(1);
    await s.next(2);
    await throws(t, () => s.next(3), "batch-enrich-fail");
});

// ═══════════════════════════════════════════════════════════════════════════════
// analytics / data processing throws
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: map → distinct → count → take → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(e => e.type)
     .operator(Operator.distinct())
     .operator(Operator.count())
     .operator(Operator.take(4))
     .connect(async () => { await sleep(3); throw new Error("analytics-error"); });
    await throws(t, () => s.next({ type: 'click' }), "analytics-error");
});

test("chain-throw: skip → distinct → mapAsync → toPromise, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.skip(2))
     .operator(Operator.distinct())
     .mapAsync(async () => { await sleep(5); throw new Error("lookup-error"); })
     .toPromise();
    await s.next('a');
    await s.next('ab');
    await throws(t, () => s.next('abc'), "lookup-error");
});

test("chain-throw: filter → pair → tap → filter → map → toPromise, throw in final map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v >= -50 && v <= 150)
     .operator(Operator.pair())
     .tap(() => {})
     .filter(([a, b]) => Math.abs(b - a) > 5)
     .map(() => { throw new Error("spike-error"); })
     .toPromise();
    await s.next(20);
    await s.next(22);
    await s.next(21);
    await throws(t, () => s.next(35), "spike-error");
});

test("chain-throw: group → mapAsync → tap → toPromise, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.group(5))
     .mapAsync(async () => { await sleep(5); throw new Error("aggregate-error"); })
     .tap(() => {})
     .toPromise();
    for (const url of ['/home', '/about', '/products', '/cart']) await s.next(url);
    await throws(t, () => s.next('/checkout'), "aggregate-error");
});

test("chain-throw: map → retry → skip → map → toPromise, throw in final map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(id => ({ id }))
     .operator(Operator.retry(2))
     .operator(Operator.skip(1))
     .map(() => { throw new Error("req-error"); })
     .toPromise();
    await s.next(1); // skipped
    await throws(t, () => s.next(2), "req-error");
});

test("chain-throw: distinct → take → mapAsync → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.distinct(msg => msg.id))
     .operator(Operator.take(3))
     .mapAsync(async () => { await sleep(3); throw new Error("format-msg-error"); })
     .toPromise();
    await throws(t, () => s.next({ id: 1, from: 'alice', text: 'hi' }), "format-msg-error");
});

test("chain-throw: strideTricks → map → connect, throw in map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.strideTricks(2, 2))
     .map(() => { throw new Error("stride-map-error"); })
     .toPromise();
    await throws(t, () => s.next([1, 2, 3, 4]), "stride-map-error");
});

test("chain-throw: map → distinct → count → filter → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(n => n.type)
     .operator(Operator.distinct())
     .operator(Operator.count())
     .filter(({ count }) => count === 0)
     .map(() => { throw new Error("notif-error"); })
     .toPromise();
    await throws(t, () => s.next({ type: 'email' }), "notif-error");
});

test("chain-throw: skip → group → mapAsync → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.skip(1))
     .operator(Operator.group(3))
     .mapAsync(async () => { await sleep(5); throw new Error("hash-error"); })
     .toPromise();
    await s.next('HEADER');
    await s.next('chunk1');
    await s.next('chunk2');
    await throws(t, () => s.next('chunk3'), "hash-error");
});

test("chain-throw: map → pair → filter → map → toPromise, throw in improvement map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(e => e.score)
     .operator(Operator.pair())
     .filter(([prev, cur]) => cur > prev)
     .map(() => { throw new Error("leaderboard-error"); })
     .toPromise();
    await s.next({ score: 100 });
    await throws(t, () => s.next({ score: 110 }), "leaderboard-error");
});

// ═══════════════════════════════════════════════════════════════════════════════
// user/auth pipeline throws
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: distinct → mapAsync → tap → take → toPromise, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.distinct(e => e.userId))
     .mapAsync(async () => { await sleep(3); throw new Error("profile-error"); })
     .tap(() => {})
     .operator(Operator.take(2))
     .toPromise();
    await throws(t, () => s.next({ userId: 1 }), "profile-error");
});

test("chain-throw: map → filter → mapAsync → toPromise, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    const allowed = new Set(['read', 'write']);
    s.map(req => req.action)
     .filter(action => allowed.has(action))
     .mapAsync(async () => { await sleep(3); throw new Error("permission-error"); })
     .toPromise();
    await throws(t, () => s.next({ action: 'read' }), "permission-error");
});

test("chain-throw: filter → map → pair → map → toPromise, throw in duration map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(e => e.type !== 'reconnect')
     .map(e => e.ts)
     .operator(Operator.pair())
     .map(() => { throw new Error("session-error"); })
     .toPromise();
    await s.next({ type: 'connect', ts: 1000 });
    await throws(t, () => s.next({ type: 'disconnect', ts: 2000 }), "session-error");
});

test("chain-throw: distinct → take → mapAsync → tap → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.distinct(r => r.email))
     .operator(Operator.take(2))
     .mapAsync(async () => { await sleep(3); throw new Error("email-send-error"); })
     .tap(() => {})
     .toPromise();
    await throws(t, () => s.next({ email: 'a@x.com' }), "email-send-error");
});

test("chain-throw: group → skip → map → toPromise, throw in map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.group(4))
     .operator(Operator.skip(1))
     .map(() => { throw new Error("rate-limit-error"); })
     .toPromise();
    for (const v of [1, 2, 3, 4]) await s.next(v); // first batch — skipped by skip(1)
    await s.next(5);
    await s.next(6);
    await s.next(7);
    await throws(t, () => s.next(8), "rate-limit-error"); // second batch completes — map throws
});

test("chain-throw: filter → mapAsync → count → take → toPromise, throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(u => u.tier === 'pro')
     .mapAsync(async () => { await sleep(2); throw new Error("flag-error"); })
     .operator(Operator.count())
     .operator(Operator.take(3))
     .toPromise();
    await throws(t, () => s.next({ id: 2, tier: 'pro' }), "flag-error");
});

test("chain-throw: map → retry → skip → map → toPromise, throw after skip propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(event => ({ ...event, attempt: 1 }))
     .operator(Operator.retry(2))
     .operator(Operator.skip(1))
     .map(() => { throw new Error("webhook-error"); })
     .toPromise();
    await s.next({ id: 'evt-1' }); // skipped
    await throws(t, () => s.next({ id: 'evt-2' }), "webhook-error");
});

test("chain-throw: pair → map → filter → mapAsync → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.pair())
     .map(([prev, cur]) => ({ from: prev.status, to: cur.status }))
     .filter(diff => diff.from !== diff.to)
     .mapAsync(async () => { await sleep(3); throw new Error("audit-persist-error"); })
     .toPromise();
    await s.next({ status: 'pending' });
    await throws(t, () => s.next({ status: 'active' }), "audit-persist-error");
});

test("chain-throw: filter → distinct → take → connect, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v.trim() !== '')
     .operator(Operator.distinct())
     .operator(Operator.take(3))
     .connect(() => { throw new Error("form-error"); });
    await throws(t, () => s.next('Alice'), "form-error");
});

test("chain-throw: group → mapAsync → tap → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.group(2))
     .mapAsync(async edits => { await sleep(2); return edits.map(e => e.toUpperCase()); })
     .tap(() => {})
     .connect(async () => { await sleep(2); throw new Error("collab-error"); });
    await s.next('ins:a');
    await throws(t, () => s.next('del:b'), "collab-error");
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromArray sync source throws
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: fromArray filter → map → distinct → take → connect, throw propagates", async (t) => {
    noUnhandled(t);
    Source.fromArray([1, 2, 2, 3, 3, 4, 5])
        .filter(v => v % 2 !== 0)
        .map(() => { throw new Error("fromArray-map-error"); })
        .operator(Operator.distinct())
        .operator(Operator.take(3))
        .toPromise()
        .catch(() => {}); // swallow for this test — just verify next() throws
    // fromArray emits synchronously so exception surfaces immediately on connect
    try {
        await Source.fromArray([1])
            .filter(v => v % 2 !== 0)
            .map(() => { throw new Error("fromArray-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "fromArray-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromArray group → map → toPromise, throw in map propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromArray([1, 2, 3, 4, 5, 6])
            .operator(Operator.group(3))
            .map(() => { throw new Error("group-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "group-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromArray skip → pair → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromArray([10, 20, 30, 40, 50])
            .operator(Operator.skip(2))
            .operator(Operator.pair())
            .map(() => { throw new Error("delta-calc-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delta-calc-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromArray distinct → count → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromArray([1, 3, 2, 4, 5, 6])
            .operator(Operator.distinct(v => v % 2))
            .operator(Operator.count())
            .map(() => { throw new Error("parity-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "parity-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromValue split → filter → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromValue([5, -1, 3, -2, 8])
            .split()
            .filter(x => x > 0)
            .map(() => { throw new Error("split-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "split-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromArray distinct → skip → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromArray([1, 2, 2, 3, 3, 3, 4])
            .operator(Operator.distinct())
            .operator(Operator.skip(1))
            .map(() => { throw new Error("dedup-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "dedup-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromArray map → distinct → group → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromArray([1, 1, 2, 2, 3, 3])
            .map(n => ({ id: n }))
            .operator(Operator.distinct(o => o.id))
            .operator(Operator.group(2))
            .map(() => { throw new Error("obj-group-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "obj-group-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromArray reduce → distinct → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromArray([3, 1, 4, 1, 5, 9, 2])
            .reduce((max, v) => Math.max(max, v), 0)
            .operator(Operator.distinct())
            .map(() => { throw new Error("running-max-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "running-max-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: fromValue strideTricks → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromValue([10, 20, 30, 40, 50, 60])
            .operator(Operator.strideTricks(3, 3))
            .map(() => { throw new Error("stride-avg-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "stride-avg-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// complex multi-operator throws
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: ETL — map → filter → distinct → group → mapAsync → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(row => ({ id: parseInt(row.id), value: parseFloat(row.value) }))
     .filter(rec => !isNaN(rec.id) && !isNaN(rec.value))
     .operator(Operator.distinct(rec => rec.id))
     .operator(Operator.group(2))
     .mapAsync(async () => { await sleep(3); throw new Error("etl-transform-error"); })
     .toPromise();
    await s.next({ id: '1', value: '10.5' });
    await throws(t, () => s.next({ id: '2', value: '20.0' }), "etl-transform-error");
});

test("chain-throw: ML — map → pair → map → skip → take → connect, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(v => v / 100)
     .operator(Operator.pair())
     .map(() => { throw new Error("delta-feature-error"); })
     .operator(Operator.skip(1))
     .operator(Operator.take(3))
     .toPromise();
    await s.next(50);
    await throws(t, () => s.next(60), "delta-feature-error");
});

test("chain-throw: event sourcing — filter → group → mapAsync → tap → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(e => e.domain === 'order')
     .operator(Operator.group(3))
     .mapAsync(async () => { await sleep(3); throw new Error("replay-error"); })
     .tap(() => {})
     .toPromise();
    await s.next({ domain: 'order', id: 'o1' });
    await s.next({ domain: 'order', id: 'o2' });
    await throws(t, () => s.next({ domain: 'order', id: 'o3' }), "replay-error");
});

test("chain-throw: IoT — distinct → map → skip → pair → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.distinct(r => r.deviceId))
     .map(r => r.voltage)
     .operator(Operator.skip(1))
     .operator(Operator.pair())
     .map(() => { throw new Error("voltage-delta-error"); })
     .toPromise();
    await s.next({ deviceId: 'A', voltage: 3.3 });
    await s.next({ deviceId: 'B', voltage: 3.1 });
    await throws(t, () => s.next({ deviceId: 'C', voltage: 3.5 }), "voltage-delta-error");
});

test("chain-throw: recommendation — map → filter → distinct → count → take → connect, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(item => ({ ...item, score: item.clicks / item.views }))
     .filter(item => item.score > 0.1)
     .operator(Operator.distinct(item => item.id))
     .operator(Operator.count())
     .operator(Operator.take(2))
     .connect(() => { throw new Error("reco-error"); });
    await throws(t, () => s.next({ id: 2, clicks: 20, views: 100 }), "reco-error");
});

test("chain-throw: tap at multiple stages — throw in first tap propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.tap(() => { throw new Error("tap-stage1-error"); })
     .filter(v => v > 0)
     .tap(() => {})
     .map(v => v * 2)
     .operator(Operator.take(2))
     .toPromise();
    await throws(t, () => s.next(3), "tap-stage1-error");
});

test("chain-throw: tap at multiple stages — throw in second tap propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.tap(() => {})
     .filter(v => v > 0)
     .tap(() => { throw new Error("tap-stage2-error"); })
     .map(v => v * 2)
     .operator(Operator.take(2))
     .toPromise();
    await throws(t, () => s.next(3), "tap-stage2-error");
});

test("chain-throw: fromArray full pipeline — filter → distinct → group → mapAsync → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromArray([2, 2, 4, 4, 6, 6, 8])
            .filter(n => n % 4 === 0)
            .operator(Operator.distinct())
            .operator(Operator.group(2))
            .mapAsync(async () => { await sleep(2); throw new Error("full-pipeline-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "full-pipeline-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("chain-throw: subject map → retry(0) → tap → reduce → toPromise, throw in tap propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(v => v * 2)
     .operator(Operator.retry(0))
     .tap(() => { throw new Error("tap-reduce-error"); })
     .reduce((sum, v) => sum + v, 0)
     .toPromise();
    await throws(t, () => s.next(1), "tap-reduce-error");
});

test("chain-throw: pair → filter spike → mapAsync → toPromise, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.pair())
     .filter(([a, b]) => b > a * 2)
     .mapAsync(async () => { await sleep(3); throw new Error("anomaly-alert-error"); })
     .toPromise();
    await s.next(10);
    await throws(t, () => s.next(25), "anomaly-alert-error");
});

test("chain-throw: skip → take → distinct → group → map → toPromise, throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.skip(1))
     .operator(Operator.take(4))
     .operator(Operator.distinct())
     .operator(Operator.group(2))
     .map(() => { throw new Error("full-coverage-error"); })
     .toPromise();
    await s.next(99); // skipped
    await s.next(1);
    await throws(t, () => s.next(2), "full-coverage-error");
});
