import { test } from "worker-testbed";
import { Subject, Source, Operator, sleep } from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// throw in terminal subscriber — propagates back to next()
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: filter → map → map → toPromise, throw in map propagates", async (t) => {
    const s = new Subject();
    const p = s.filter(price => price > 100)
               .map(price => price * 0.9)
               .map(() => { throw new Error("format-error"); })
               .toPromise();
    s.next(200).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "format-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: mapAsync → distinct → take → connect, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const p = s.mapAsync(async () => { await sleep(5); throw new Error("enrich-fail"); })
               .operator(Operator.distinct(o => o.id))
               .operator(Operator.take(3))
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "enrich-fail") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: skip → group → connect, throw in connect propagates", async (t) => {
    const s = new Subject();
    s.operator(Operator.skip(1))
     .operator(Operator.group(2))
     .connect(() => { throw new Error("page-handler-error"); });
    await s.next("header"); // skipped
    await s.next("apple");  // item 1 — group not full yet
    try {
        await s.next("banana"); // item 2 — group emits
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "page-handler-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: filter → pair → map → toPromise, throw in pair map propagates", async (t) => {
    const s = new Subject();
    const p = s.filter(p => p > 0)
               .operator(Operator.pair())
               .map(() => { throw new Error("delta-error"); })
               .toPromise();
    await s.next(100); // no pair yet
    s.next(105).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delta-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: count → filter → map → toPromise, throw in final map propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.count())
               .filter(({ count }) => count >= 2)
               .map(() => { throw new Error("streak-error"); })
               .toPromise();
    await s.next(20);
    await s.next(20);
    s.next(20).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "streak-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: skip → take → connect, async throw propagates", async (t) => {
    const s = new Subject();
    s.operator(Operator.skip(2))
     .operator(Operator.take(3))
     .connect(async () => { await sleep(5); throw new Error("log-error"); });
    await s.next("boot1");
    await s.next("boot2");
    try {
        await s.next("err1");
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "log-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: distinct → mapAsync → tap → toPromise, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.distinct())
               .mapAsync(async () => { await sleep(5); throw new Error("fetch-error"); })
               .tap(() => {})
               .toPromise();
    s.next(42).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "fetch-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: filter → retry → map → connect, async throw propagates through retry", async (t) => {
    const s = new Subject();
    s.filter(tx => tx.amount > 0)
     .operator(Operator.retry(1))
     .connect(async () => { await sleep(5); throw new Error("tx-error"); });
    try {
        await s.next({ amount: 50 });
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "tx-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: filter → pair → map → toPromise, throw in moving-avg map propagates", async (t) => {
    const s = new Subject();
    const p = s.filter(v => !isNaN(v))
               .operator(Operator.pair())
               .map(() => { throw new Error("avg-error"); })
               .toPromise();
    await s.next(10);
    s.next(20).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "avg-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: group → mapAsync → toPromise, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.group(3))
               .mapAsync(async () => { await sleep(5); throw new Error("batch-enrich-fail"); })
               .toPromise();
    await s.next(1);
    await s.next(2);
    s.next(3).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "batch-enrich-fail") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// analytics / data processing throws
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: map → distinct → count → take → connect, async throw propagates", async (t) => {
    const s = new Subject();
    s.map(e => e.type)
     .operator(Operator.distinct())
     .operator(Operator.count())
     .operator(Operator.take(4))
     .connect(async () => { await sleep(3); throw new Error("analytics-error"); });
    try {
        await s.next({ type: 'click' });
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "analytics-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: skip → distinct → mapAsync → toPromise, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.skip(2))
               .operator(Operator.distinct())
               .mapAsync(async () => { await sleep(5); throw new Error("lookup-error"); })
               .toPromise();
    await s.next('a');
    await s.next('ab');
    s.next('abc').catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "lookup-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: filter → pair → tap → filter → map → toPromise, throw in final map propagates", async (t) => {
    const s = new Subject();
    const p = s.filter(v => v >= -50 && v <= 150)
               .operator(Operator.pair())
               .tap(() => {})
               .filter(([a, b]) => Math.abs(b - a) > 5)
               .map(() => { throw new Error("spike-error"); })
               .toPromise();
    await s.next(20);
    await s.next(22);
    await s.next(21);
    s.next(35).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "spike-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: group → mapAsync → tap → toPromise, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.group(5))
               .mapAsync(async () => { await sleep(5); throw new Error("aggregate-error"); })
               .tap(() => {})
               .toPromise();
    for (const url of ['/home', '/about', '/products', '/cart']) await s.next(url);
    s.next('/checkout').catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "aggregate-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: map → retry → skip → map → toPromise, throw in final map propagates", async (t) => {
    const s = new Subject();
    const p = s.map(id => ({ id }))
               .operator(Operator.retry(2))
               .operator(Operator.skip(1))
               .map(() => { throw new Error("req-error"); })
               .toPromise();
    await s.next(1); // skipped
    s.next(2).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "req-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: distinct → take → mapAsync → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.distinct(msg => msg.id))
               .operator(Operator.take(3))
               .mapAsync(async () => { await sleep(3); throw new Error("format-msg-error"); })
               .toPromise();
    s.next({ id: 1, from: 'alice', text: 'hi' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "format-msg-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: strideTricks → map → toPromise, throw in map propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.strideTricks(2, 2))
               .map(() => { throw new Error("stride-map-error"); })
               .toPromise();
    s.next([1, 2, 3, 4]).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "stride-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: map → distinct → count → filter → map → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.map(n => n.type)
               .operator(Operator.distinct())
               .operator(Operator.count())
               .filter(({ count }) => count === 0)
               .map(() => { throw new Error("notif-error"); })
               .toPromise();
    s.next({ type: 'email' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "notif-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: skip → group → mapAsync → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.skip(1))
               .operator(Operator.group(3))
               .mapAsync(async () => { await sleep(5); throw new Error("hash-error"); })
               .toPromise();
    await s.next('HEADER');
    await s.next('chunk1');
    await s.next('chunk2');
    s.next('chunk3').catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "hash-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: map → pair → filter → map → toPromise, throw in improvement map propagates", async (t) => {
    const s = new Subject();
    const p = s.map(e => e.score)
               .operator(Operator.pair())
               .filter(([prev, cur]) => cur > prev)
               .map(() => { throw new Error("leaderboard-error"); })
               .toPromise();
    await s.next({ score: 100 });
    s.next({ score: 110 }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "leaderboard-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// user/auth pipeline throws
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: distinct → mapAsync → tap → take → toPromise, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.distinct(e => e.userId))
               .mapAsync(async () => { await sleep(3); throw new Error("profile-error"); })
               .tap(() => {})
               .operator(Operator.take(2))
               .toPromise();
    s.next({ userId: 1 }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "profile-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: map → filter → mapAsync → toPromise, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const allowed = new Set(['read', 'write']);
    const p = s.map(req => req.action)
               .filter(action => allowed.has(action))
               .mapAsync(async () => { await sleep(3); throw new Error("permission-error"); })
               .toPromise();
    s.next({ action: 'read' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "permission-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: filter → map → pair → map → toPromise, throw in duration map propagates", async (t) => {
    const s = new Subject();
    const p = s.filter(e => e.type !== 'reconnect')
               .map(e => e.ts)
               .operator(Operator.pair())
               .map(() => { throw new Error("session-error"); })
               .toPromise();
    await s.next({ type: 'connect', ts: 1000 });
    s.next({ type: 'disconnect', ts: 2000 }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "session-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: distinct → take → mapAsync → tap → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.distinct(r => r.email))
               .operator(Operator.take(2))
               .mapAsync(async () => { await sleep(3); throw new Error("email-send-error"); })
               .tap(() => {})
               .toPromise();
    s.next({ email: 'a@x.com' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "email-send-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: group → skip → map → toPromise, throw in map propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.group(4))
               .operator(Operator.skip(1))
               .map(() => { throw new Error("rate-limit-error"); })
               .toPromise();
    for (const v of [1, 2, 3, 4]) await s.next(v); // first batch — skipped by skip(1)
    await s.next(5);
    await s.next(6);
    await s.next(7);
    s.next(8).catch(() => {}); // second batch completes — map throws
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "rate-limit-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: filter → mapAsync → count → take → toPromise, throw in mapAsync propagates", async (t) => {
    const s = new Subject();
    const p = s.filter(u => u.tier === 'pro')
               .mapAsync(async () => { await sleep(2); throw new Error("flag-error"); })
               .operator(Operator.count())
               .operator(Operator.take(3))
               .toPromise();
    s.next({ id: 2, tier: 'pro' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "flag-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: map → retry → skip → map → toPromise, throw after skip propagates", async (t) => {
    const s = new Subject();
    const p = s.map(event => ({ ...event, attempt: 1 }))
               .operator(Operator.retry(2))
               .operator(Operator.skip(1))
               .map(() => { throw new Error("webhook-error"); })
               .toPromise();
    await s.next({ id: 'evt-1' }); // skipped
    s.next({ id: 'evt-2' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "webhook-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: pair → map → filter → mapAsync → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.pair())
               .map(([prev, cur]) => ({ from: prev.status, to: cur.status }))
               .filter(diff => diff.from !== diff.to)
               .mapAsync(async () => { await sleep(3); throw new Error("audit-persist-error"); })
               .toPromise();
    await s.next({ status: 'pending' });
    s.next({ status: 'active' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "audit-persist-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: filter → distinct → take → connect, throw propagates", async (t) => {
    const s = new Subject();
    s.filter(v => v.trim() !== '')
     .operator(Operator.distinct())
     .operator(Operator.take(3))
     .connect(() => { throw new Error("form-error"); });
    try {
        await s.next('Alice');
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "form-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: group → mapAsync → tap → connect, async throw propagates", async (t) => {
    const s = new Subject();
    s.operator(Operator.group(2))
     .mapAsync(async edits => { await sleep(2); return edits.map(e => e.toUpperCase()); })
     .tap(() => {})
     .connect(async () => { await sleep(2); throw new Error("collab-error"); });
    await s.next('ins:a');
    try {
        await s.next('del:b');
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "collab-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromArray sync source throws
// ═══════════════════════════════════════════════════════════════════════════════

test("chain-throw: fromArray filter → map → toPromise, throw propagates", async (t) => {
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
    const s = new Subject();
    const p = s.map(row => ({ id: parseInt(row.id), value: parseFloat(row.value) }))
               .filter(rec => !isNaN(rec.id) && !isNaN(rec.value))
               .operator(Operator.distinct(rec => rec.id))
               .operator(Operator.group(2))
               .mapAsync(async () => { await sleep(3); throw new Error("etl-transform-error"); })
               .toPromise();
    await s.next({ id: '1', value: '10.5' });
    s.next({ id: '2', value: '20.0' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "etl-transform-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: ML — map → pair → map → skip → take → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.map(v => v / 100)
               .operator(Operator.pair())
               .map(() => { throw new Error("delta-feature-error"); })
               .operator(Operator.skip(1))
               .operator(Operator.take(3))
               .toPromise();
    await s.next(50);
    s.next(60).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delta-feature-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: event sourcing — filter → group → mapAsync → tap → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.filter(e => e.domain === 'order')
               .operator(Operator.group(3))
               .mapAsync(async () => { await sleep(3); throw new Error("replay-error"); })
               .tap(() => {})
               .toPromise();
    await s.next({ domain: 'order', id: 'o1' });
    await s.next({ domain: 'order', id: 'o2' });
    s.next({ domain: 'order', id: 'o3' }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "replay-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: IoT — distinct → map → skip → pair → map → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.distinct(r => r.deviceId))
               .map(r => r.voltage)
               .operator(Operator.skip(1))
               .operator(Operator.pair())
               .map(() => { throw new Error("voltage-delta-error"); })
               .toPromise();
    await s.next({ deviceId: 'A', voltage: 3.3 });
    await s.next({ deviceId: 'B', voltage: 3.1 });
    s.next({ deviceId: 'C', voltage: 3.5 }).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "voltage-delta-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: recommendation — map → filter → distinct → count → take → connect, throw propagates", async (t) => {
    const s = new Subject();
    s.map(item => ({ ...item, score: item.clicks / item.views }))
     .filter(item => item.score > 0.1)
     .operator(Operator.distinct(item => item.id))
     .operator(Operator.count())
     .operator(Operator.take(2))
     .connect(() => { throw new Error("reco-error"); });
    try {
        await s.next({ id: 2, clicks: 20, views: 100 });
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "reco-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: tap at multiple stages — throw in first tap propagates", async (t) => {
    const s = new Subject();
    const p = s.tap(() => { throw new Error("tap-stage1-error"); })
               .filter(v => v > 0)
               .tap(() => {})
               .map(v => v * 2)
               .operator(Operator.take(2))
               .toPromise();
    s.next(3).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "tap-stage1-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: tap at multiple stages — throw in second tap propagates", async (t) => {
    const s = new Subject();
    const p = s.tap(() => {})
               .filter(v => v > 0)
               .tap(() => { throw new Error("tap-stage2-error"); })
               .map(v => v * 2)
               .operator(Operator.take(2))
               .toPromise();
    s.next(3).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "tap-stage2-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: fromArray full pipeline — filter → distinct → group → mapAsync → toPromise, throw propagates", async (t) => {
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
    const s = new Subject();
    const p = s.map(v => v * 2)
               .operator(Operator.retry(0))
               .tap(() => { throw new Error("tap-reduce-error"); })
               .reduce((sum, v) => sum + v, 0)
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "tap-reduce-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: pair → filter spike → mapAsync → toPromise, async throw propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.pair())
               .filter(([a, b]) => b > a * 2)
               .mapAsync(async () => { await sleep(3); throw new Error("anomaly-alert-error"); })
               .toPromise();
    await s.next(10);
    s.next(25).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "anomaly-alert-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("chain-throw: skip → take → distinct → group → map → toPromise, throw propagates", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.skip(1))
               .operator(Operator.take(4))
               .operator(Operator.distinct())
               .operator(Operator.group(2))
               .map(() => { throw new Error("full-coverage-error"); })
               .toPromise();
    await s.next(99); // skipped
    await s.next(1);
    s.next(2).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "full-coverage-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});
