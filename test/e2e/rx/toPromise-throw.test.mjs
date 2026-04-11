import { test } from "worker-testbed";
import { Subject, sleep } from "../../../build/index.mjs";

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

// ─── single operator → toPromise ─────────────────────────────────────────────

test("toPromise-throw: filter → toPromise, async throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    const chain = s.filter(v => v > 0);
    chain.connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(1), "1");
});

test("toPromise-throw: map → toPromise, async throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    const chain = s.map(v => v * 2);
    chain.connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(3), "6");
});

test("toPromise-throw: mapAsync → toPromise, exception propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(99), "99");
});

test("toPromise-throw: tap → toPromise, async throw in tap propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.tap(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(7), "7");
});

// ─── chained operators → toPromise ───────────────────────────────────────────

test("toPromise-throw: filter → map → toPromise, async throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).map(v => v * 10).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(2), "20");
});

test("toPromise-throw: filter → map → mapAsync → toPromise, exception propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).map(v => v * 2).mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(5), "10");
});

test("toPromise-throw: map → filter → mapAsync → toPromise, exception propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(v => v + 1).filter(v => v > 0).mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(4), "5");
});

test("toPromise-throw: map → tap → toPromise, async throw in tap propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(v => v * 3).tap(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(4), "12");
});

test("toPromise-throw: reduce → map → toPromise, async throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.reduce((acm, v) => acm + v, 0).map(v => v * 2).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(5), "10");
});

test("toPromise-throw: flatMap → filter → toPromise, async throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.flatMap(v => [v, v * 10]).filter(v => v > 5).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(1), "10");
});

test("toPromise-throw: filter → flatMap → mapAsync → toPromise, exception propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).flatMap(v => [v]).mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next(6), "6");
});

test("toPromise-throw: split → map → mapAsync → toPromise, exception propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.split().map(v => v * 3).mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s.next([4]), "12");
});

test("toPromise-throw: deep chain filter→map→filter→mapAsync→toPromise, exception propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s
        .filter(v => v > 0)
        .map(v => v * 2)
        .filter(v => v < 100)
        .mapAsync(async (v) => { await sleep(5); throw new Error(String(v + 1)); })
        .toPromise();
    await throws(t, () => s.next(3), "7");
});

// ─── filtered value does NOT throw ───────────────────────────────────────────

test("toPromise-throw: filter → mapAsync → toPromise, filtered value does NOT throw", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).mapAsync(async (v) => { throw new Error(String(v)); }).toPromise();
    // v=0 filtered out → no throw
    await s.next(0);
    t.pass();
});

// ─── mapAsync fallbackfn ──────────────────────────────────────────────────────

test("toPromise-throw: mapAsync with fallbackfn → fallback called, no propagation", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    let caught = null;
    s.mapAsync(
        async (v) => { await sleep(5); throw new Error("fallback-" + v); },
        (e) => { caught = e; }
    ).toPromise();
    await s.next(1);
    if (caught instanceof Error && caught.message === "fallback-1") {
        t.pass();
    } else {
        t.fail(`expected fallback, got: ${caught}`);
    }
});

// ─── merge → toPromise ────────────────────────────────────────────────────────

test("toPromise-throw: merge → mapAsync → toPromise, exception from s1 propagates", async (t) => {
    noUnhandled(t);
    const s1 = new Subject();
    const s2 = new Subject();
    s1.merge(s2.toObserver()).mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s1.next(55), "55");
});

test("toPromise-throw: merge → mapAsync → toPromise, exception from s2 propagates", async (t) => {
    noUnhandled(t);
    const s1 = new Subject();
    const s2 = new Subject();
    s1.merge(s2.toObserver()).mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).toPromise();
    await throws(t, () => s2.next(77), "77");
});
