import { test } from "worker-testbed";
import { Subject, Source, Operator, sleep } from "../../../build/index.mjs";

test("toIteratorContext: collects all values without dropping any", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    for (const v of [1, 2, 3, 4, 5]) await s.next(v);
    done();
    await consumer;
    if (results.join(',') === '1,2,3,4,5') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: rapid burst — no elements dropped", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    // fire all without awaiting — stress test the buffer
    const nexts = [10, 20, 30, 40, 50].map(v => s.next(v));
    await Promise.all(nexts);
    done();
    await consumer;
    if (results.length === 5 && results.join(',') === '10,20,30,40,50') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: slow consumer — buffer holds elements", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            await sleep(10); // slow consumer
            results.push(v);
        }
    })();
    for (const v of [1, 2, 3]) await s.next(v);
    done();
    await consumer;
    if (results.join(',') === '1,2,3') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: works with map chain", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.map(v => v * 2).toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    for (const v of [1, 2, 3]) await s.next(v);
    done();
    await consumer;
    if (results.join(',') === '2,4,6') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: done() stops iteration cleanly", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    await s.next(1);
    await s.next(2);
    done();
    await consumer;
    if (results.length >= 2) t.pass();
    else t.fail(`got only ${results.length} elements`);
});

test("toIteratorContext: fromArray — no elements dropped", async (t) => {
    const { iterate, done } = Source.fromArray([10, 20, 30, 40]).toIteratorContext();
    const results = [];
    for await (const v of iterate()) {
        results.push(v);
        if (results.length === 4) done();
    }
    if (results.join(',') === '10,20,30,40') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: operator(take) — stops after N elements, none dropped", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.operator(Operator.take(3)).toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
            if (results.length === 3) done();
        }
    })();
    for (const v of [1, 2, 3, 4, 5]) await s.next(v);
    await consumer;
    if (results.join(',') === '1,2,3') t.pass();
    else t.fail(`got ${results}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("toIteratorContext: throw in map propagates to for-await", async (t) => {
    const s = new Subject();
    const { iterate } = s.map(() => { throw new Error("iter-map-error"); }).toIteratorContext();
    const consumer = (async () => {
        for await (const _ of iterate()) { }
    })();
    await sleep(5);
    s.next(1).catch(() => {});
    try {
        await consumer;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "iter-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("toIteratorContext: throw in mapAsync propagates to for-await", async (t) => {
    const s = new Subject();
    const { iterate } = s.mapAsync(async () => { await sleep(5); throw new Error("iter-mapAsync-error"); }).toIteratorContext();
    const consumer = (async () => {
        for await (const _ of iterate()) { }
    })();
    await sleep(5);
    s.next(1).catch(() => {});
    try {
        await consumer;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "iter-mapAsync-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("toIteratorContext: throw in tap propagates to for-await", async (t) => {
    const s = new Subject();
    const { iterate } = s.tap(() => { throw new Error("iter-tap-error"); }).toIteratorContext();
    const consumer = (async () => {
        for await (const _ of iterate()) { }
    })();
    await sleep(5);
    s.next(1).catch(() => {});
    try {
        await consumer;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "iter-tap-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("toIteratorContext: throw in filter propagates to for-await", async (t) => {
    const s = new Subject();
    const { iterate } = s.filter(() => { throw new Error("iter-filter-error"); }).toIteratorContext();
    const consumer = (async () => {
        for await (const _ of iterate()) { }
    })();
    await sleep(5);
    s.next(1).catch(() => {});
    try {
        await consumer;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "iter-filter-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("toIteratorContext: values before error are yielded, then throws", async (t) => {
    const s = new Subject();
    let count = 0;
    const { iterate } = s.map(v => {
        if (v === 3) throw new Error("iter-mid-error");
        return v;
    }).toIteratorContext();
    const results = [];
    const nexts = async () => {
        await s.next(1);
        await s.next(2);
        s.next(3).catch(() => {});
    };
    nexts();
    try {
        for await (const v of iterate()) {
            results.push(v);
        }
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "iter-mid-error" && results.join(',') === '1,2') t.pass();
        else t.fail(`unexpected: ${e}, results=${results}`);
    }
});

test("toIteratorContext: fromPromise reject propagates to for-await", async (t) => {
    const { iterate } = Source.fromPromise(async () => { throw new Error("iter-promise-error"); })
        .map(v => v)
        .toIteratorContext();
    try {
        for await (const _ of iterate()) { }
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "iter-promise-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("toIteratorContext: multi-hop chain throw propagates to for-await", async (t) => {
    const s = new Subject();
    const { iterate } = s
        .filter(v => v > 0)
        .map(v => v * 2)
        .mapAsync(async () => { await sleep(3); throw new Error("iter-chain-error"); })
        .toIteratorContext();
    const consumer = (async () => {
        for await (const _ of iterate()) { }
    })();
    await sleep(5);
    s.next(1).catch(() => {});
    try {
        await consumer;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "iter-chain-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});
