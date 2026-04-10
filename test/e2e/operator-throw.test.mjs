import { test } from "worker-testbed";
import { Subject, sleep, createAwaiter } from "../../build/index.mjs";

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

// ─── single operator ──────────────────────────────────────────────────────────

test("throw: sync throw in connect callback propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().connect((v) => { throw new Error(String(v)); });
    await throws(t, () => s.next(42), "42");
});

test("throw: async throw in connect callback propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(42), "42");
});

test("throw: sync throw in filter predicate propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter((v) => { throw new Error(String(v)); }).connect(() => {});
    await throws(t, () => s.next(7), "7");
});

test("throw: sync throw in map callback propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map((v) => { throw new Error(String(v)); }).connect(() => {});
    await throws(t, () => s.next(7), "7");
});

test("throw: async throw after map in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map((v) => v * 2).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(5), "10");
});

test("throw: sync throw in tap callback propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.tap((v) => { throw new Error(String(v)); }).connect(() => {});
    await throws(t, () => s.next(3), "3");
});

test("throw: async throw after tap in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.tap(() => {}).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(3), "3");
});

test("throw: sync throw in reduce callback propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.reduce((acm, v) => { throw new Error(String(v)); }, 0).connect(() => {});
    await throws(t, () => s.next(9), "9");
});

test("throw: async throw after reduce in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.reduce((acm, v) => acm + v, 0).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(4), "4");
});

test("throw: sync throw in flatMap callback propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.flatMap((v) => { throw new Error(String(v)); }).connect(() => {});
    await throws(t, () => s.next(6), "6");
});

test("throw: async throw after flatMap in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.flatMap((v) => [v, v]).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(8), "8");
});

test("throw: sync throw in split connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.split().connect((v) => { throw new Error(String(v)); });
    await throws(t, () => s.next([11, 12]), "11");
});

test("throw: async throw after split in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.split().connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next([99]), "99");
});

// ─── chained operators ────────────────────────────────────────────────────────

test("throw: filter → map → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).map(v => v * 10).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(2), "20");
});

test("throw: filter → map → connect, filtered value does NOT throw", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).map(v => v * 10).connect(async (v) => { throw new Error(String(v)); });
    // v=0 filtered out → no throw
    await s.next(0);
    t.pass();
});

test("throw: map → filter → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(v => v + 1).filter(v => v > 0).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(5), "6");
});

test("throw: map → tap → filter → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(v => v * 2).tap(() => {}).filter(v => v > 0).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(3), "6");
});

test("throw: reduce → map → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.reduce((acm, v) => acm + v, 0).map(v => v * 2).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(5), "10");
});

test("throw: flatMap → filter → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.flatMap(v => [v, v * 10]).filter(v => v > 5).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(1), "10");
});

test("throw: split → map → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.split().map(v => v * 3).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next([4]), "12");
});

test("throw: filter → flatMap → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 0).flatMap(v => [v]).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(7), "7");
});

test("throw: map → reduce → tap → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(v => v + 1).reduce((a, v) => a + v, 0).tap(() => {}).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(9), "10");
});

// ─── merge ────────────────────────────────────────────────────────────────────

test("throw: merge → connect, async throw from s1 propagates", async (t) => {
    noUnhandled(t);
    const s1 = new Subject();
    const s2 = new Subject();
    s1.merge(s2.toObserver()).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s1.next(55), "55");
});

test("throw: merge → connect, async throw from s2 propagates", async (t) => {
    noUnhandled(t);
    const s1 = new Subject();
    const s2 = new Subject();
    s1.merge(s2.toObserver()).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s2.next(77), "77");
});


test("throw: merge → filter → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s1 = new Subject();
    const s2 = new Subject();
    s1.merge(s2.toObserver()).filter(v => v > 0).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s1.next(13), "13");
});

// ─── multiple subscribers ─────────────────────────────────────────────────────

test("throw: two subscribers, both async throw, first propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v === 1).connect(async (v) => { await sleep(5); throw new Error("a" + v); });
    s.filter(v => v === 1).connect(async (v) => { await sleep(5); throw new Error("b" + v); });
    await throws(t, () => s.next(1), "a1");
});


test("throw: debounce → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    const [promise, awaiter] = createAwaiter();
    s.debounce(40).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    s.next(44).catch((e) => awaiter.reject(e));
    await throws(t, () => promise, "44");
});

test("throw: repeat → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.repeat(50).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(33), "33");
});


test("throw: mapAsync → connect, async throw in mapAsync callback propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.mapAsync(async (v) => { await sleep(5); throw new Error(String(v)); }).connect(() => {});
    await throws(t, () => s.next(55), "55");
});

test("throw: mapAsync → connect, async throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.mapAsync(async (v) => { await sleep(5); return v * 2; }).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(3), "6");
});

test("throw: delay → connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    const [promise, awaiter] = createAwaiter();
    s.delay(30).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    s.next(77).catch((e) => awaiter.reject(e));
    await throws(t, () => promise, "77");
});

test("throw: deep chain filter→map→filter→map→connect, async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s
        .filter(v => v > 0)
        .map(v => v * 2)
        .filter(v => v < 100)
        .map(v => v + 1)
        .connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(3), "7");
});
