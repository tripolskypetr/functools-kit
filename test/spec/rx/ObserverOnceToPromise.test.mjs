import { test } from "worker-testbed";
import { Subject, Source, sleep, createAwaiter } from "../../../build/index.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

const noUnhandled = (t) => {
    process.on("unhandledRejection", (reason) => {
        t.fail("unhandled rejection: " + reason);
    });
};

const throws = async (t, fn, expectedMsg) => {
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === expectedMsg) {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// once
// ═══════════════════════════════════════════════════════════════════════════════

test("once: fires exactly once on first value", async (t) => {
    const s = new Subject();
    let count = 0;
    s.toObserver().once(() => { count++; });
    await s.next(1);
    await s.next(2);
    await s.next(3);
    if (count === 1) t.pass();
    else t.fail(`expected count=1, got ${count}`);
});

test("once: receives correct value", async (t) => {
    const s = new Subject();
    let received = null;
    s.toObserver().once((v) => { received = v; });
    await s.next(42);
    if (received === 42) t.pass();
    else t.fail(`expected 42, got ${received}`);
});

test("once: unsubscribe before fire suppresses callback", async (t) => {
    const s = new Subject();
    let count = 0;
    const unsub = s.toObserver().once(() => { count++; });
    unsub();
    await s.next(1);
    if (count === 0) t.pass();
    else t.fail(`expected count=0, got ${count}`);
});

test("once: works on chained observer (filter → once)", async (t) => {
    const s = new Subject();
    let received = null;
    s.filter(v => v > 0).once((v) => { received = v; });
    await s.next(0);   // filtered
    await s.next(5);   // passes
    await s.next(10);  // should not reach once (already fired)
    if (received === 5) t.pass();
    else t.fail(`expected 5, got ${received}`);
});

test("once: works on chained observer (map → once)", async (t) => {
    const s = new Subject();
    let received = null;
    s.map(v => v * 2).once((v) => { received = v; });
    await s.next(7);
    if (received === 14) t.pass();
    else t.fail(`expected 14, got ${received}`);
});

test("once: multiple independent once subscriptions each fire once", async (t) => {
    const s = new Subject();
    const obs = s.toObserver();
    let a = null, b = null;
    obs.once((v) => { a = v; });
    obs.once((v) => { b = v; });
    await s.next(1);
    await s.next(2);
    if (a === 1 && b === 1) t.pass();
    else t.fail(`expected a=1 b=1, got a=${a} b=${b}`);
});

test("once: async callback awaited — side-effect visible after next()", async (t) => {
    const s = new Subject();
    let done = false;
    s.toObserver().once(async () => { await sleep(10); done = true; });
    await s.next(1);
    if (done) t.pass();
    else t.fail("async once callback was not awaited");
});

test("once: async throw in callback propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().once(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(99), "99");
});

test("once: sync throw in callback propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().once((v) => { throw new Error(String(v)); });
    await throws(t, () => s.next(7), "7");
});

test("once: does not fire again after throw", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    let count = 0;
    s.toObserver().once((v) => { count++; throw new Error("x"); });
    try { await s.next(1); } catch {}
    try { await s.next(2); } catch {}
    if (count === 1) t.pass();
    else t.fail(`expected count=1, got ${count}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// toPromise
// ═══════════════════════════════════════════════════════════════════════════════

test("toPromise: resolves with first emitted value", async (t) => {
    const s = new Subject();
    const p = s.toObserver().toPromise();
    await s.next(42);
    const v = await p;
    if (v === 42) t.pass();
    else t.fail(`expected 42, got ${v}`);
});

test("toPromise: resolves only first value, ignores subsequent", async (t) => {
    const s = new Subject();
    const p = s.toObserver().toPromise();
    await s.next(1);
    await s.next(2);
    const v = await p;
    if (v === 1) t.pass();
    else t.fail(`expected 1, got ${v}`);
});

test("toPromise: called multiple times returns same promise", async (t) => {
    const s = new Subject();
    const obs = s.toObserver();
    const p1 = obs.toPromise();
    const p2 = obs.toPromise();
    await s.next(99);
    const [v1, v2] = await Promise.all([p1, p2]);
    if (v1 === 99 && v2 === 99) t.pass();
    else t.fail(`expected 99/99, got ${v1}/${v2}`);
});

test("toPromise: works with Source.fromArray", async (t) => {
    const v = await Source.fromArray([10, 20, 30]).toPromise();
    if (v === 10) t.pass();
    else t.fail(`expected 10, got ${v}`);
});

test("toPromise: works with Source.fromValue", async (t) => {
    const v = await Source.fromValue(7).toPromise();
    if (v === 7) t.pass();
    else t.fail(`expected 7, got ${v}`);
});

test("toPromise: works after chain filter → map", async (t) => {
    const s = new Subject();
    const p = s.filter(v => v > 0).map(v => v * 10).toPromise();
    await s.next(0);  // filtered
    await s.next(3);  // passes → 30
    const v = await p;
    if (v === 30) t.pass();
    else t.fail(`expected 30, got ${v}`);
});

test("toPromise: works after chain map → filter", async (t) => {
    const s = new Subject();
    const p = s.map(v => v + 1).filter(v => v > 5).toPromise();
    await s.next(2);  // → 3, filtered
    await s.next(6);  // → 7, passes
    const v = await p;
    if (v === 7) t.pass();
    else t.fail(`expected 7, got ${v}`);
});

test("toPromise: works after mapAsync chain", async (t) => {
    const s = new Subject();
    const p = s.mapAsync(async (v) => { await sleep(5); return v * 3; }).toPromise();
    await s.next(4);
    const v = await p;
    if (v === 12) t.pass();
    else t.fail(`expected 12, got ${v}`);
});

test("toPromise: works after flatMap", async (t) => {
    const s = new Subject();
    const p = s.flatMap(v => [v * 10, v * 20]).toPromise();
    await s.next(2);
    const v = await p;
    if (v === 20) t.pass();
    else t.fail(`expected 20, got ${v}`);
});

test("toPromise: works after split", async (t) => {
    const s = new Subject();
    const p = s.split().toPromise();
    await s.next([5, 6, 7]);
    const v = await p;
    if (v === 5) t.pass();
    else t.fail(`expected 5, got ${v}`);
});

test("toPromise: works after tap (value passes through)", async (t) => {
    const s = new Subject();
    let sideEffect = null;
    const p = s.tap(v => { sideEffect = v; }).toPromise();
    await s.next(55);
    const v = await p;
    if (v === 55 && sideEffect === 55) t.pass();
    else t.fail(`expected v=55 side=55, got v=${v} side=${sideEffect}`);
});

test("toPromise: works after reduce", async (t) => {
    const s = new Subject();
    const p = s.reduce((a, v) => a + v, 0).toPromise();
    await s.next(3);
    const v = await p;
    if (v === 3) t.pass();
    else t.fail(`expected 3, got ${v}`);
});

test("toPromise: works with Source.fromPromise", async (t) => {
    const v = await Source.fromPromise(async () => { await sleep(10); return 77; }).toPromise();
    if (v === 77) t.pass();
    else t.fail(`expected 77, got ${v}`);
});

test("toPromise: works with Source.fromDelay", async (t) => {
    const p = Source.fromDelay(30).toPromise();
    const v = await p;
    if (v === undefined) t.pass();
    else t.fail(`expected undefined, got ${v}`);
});

test("toPromise: async throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(11), "11");
});

test("toPromise: async throw in tap propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.tap(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(22), "22");
});

test("toPromise: async throw in filter→map→mapAsync chain propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).map(v => v * 2).mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(5), "10");
});

test("toPromise: Subject.toPromise resolves first value", async (t) => {
    const s = new Subject();
    const p = s.toPromise();
    await s.next(123);
    const v = await p;
    if (v === 123) t.pass();
    else t.fail(`expected 123, got ${v}`);
});
