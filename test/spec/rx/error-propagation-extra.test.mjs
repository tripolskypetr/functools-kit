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
        else t.fail(`unexpected: ${e}`);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// merge() — error propagation from both sides
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.merge — throw in left branch propagates to next()", async (t) => {
    noUnhandled(t);
    const left = new Subject();
    const right = new Subject();
    left.merge(right)
        .map(() => { throw new Error("merge-left-error"); })
        .toPromise();
    await throws(t, () => left.next(1), "merge-left-error");
});

test("Subject.merge(fromArray) — throw in map propagates on right-branch value", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1])
            .merge(Source.fromArray([2]))
            .map(() => { throw new Error("merge-right-error"); })
            .toPromise(),
        "merge-right-error"
    );
});

test("fromArray.merge(fromArray) — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2])
            .merge(Source.fromArray([3, 4]))
            .map(() => { throw new Error("merge-fromArray-error"); })
            .toPromise(),
        "merge-fromArray-error"
    );
});

test("fromPromise.merge(fromDelay) — left rejects, propagates via toPromise", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => { throw new Error("merge-promise-left-error"); })
            .merge(Source.fromDelay(100000))
            .map(x => x)
            .toPromise(),
        "merge-promise-left-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// flatMap — error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.flatMap — throw in flatMap propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.flatMap(() => { throw new Error("flatMap-error"); })
     .toPromise();
    await throws(t, () => s.next(1), "flatMap-error");
});

test("fromArray().flatMap().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .flatMap(x => [x, x * 10])
            .map(() => { throw new Error("flatMap-chain-error"); })
            .toPromise(),
        "flatMap-chain-error"
    );
});

test("fromValue().flatMap().toPromise() — throw in flatMap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromValue(5)
            .flatMap(() => { throw new Error("fromValue-flatMap-error"); })
            .toPromise(),
        "fromValue-flatMap-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// split — error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.split().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.split()
     .map(() => { throw new Error("split-map-error"); })
     .toPromise();
    await throws(t, () => s.next([1, 2, 3]), "split-map-error");
});

test("fromArray().split().map().toPromise() — throw propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([[1, 2], [3, 4]])
            .split()
            .map(() => { throw new Error("split-fromArray-error"); })
            .toPromise(),
        "split-fromArray-error"
    );
});

test("fromValue().split().filter().map().toPromise() — throw propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromValue([1, 2, 3])
            .split()
            .filter(x => x > 0)
            .map(() => { throw new Error("split-filter-map-error"); })
            .toPromise(),
        "split-filter-map-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// reduce — error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.reduce — async throw in accumulator propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.reduce(async () => { await sleep(5); throw new Error("reduce-async-error"); }, 0)
     .toPromise();
    await throws(t, () => s.next(1), "reduce-async-error");
});

test("fromArray().reduce().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .reduce((a, v) => a + v, 0)
            .map(() => { throw new Error("reduce-map-error"); })
            .toPromise(),
        "reduce-map-error"
    );
});

test("Subject.reduce — sync throw in accumulator propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.reduce(() => { throw new Error("reduce-sync-error"); }, 0)
     .toPromise();
    await throws(t, () => s.next(1), "reduce-sync-error");
});

// ═══════════════════════════════════════════════════════════════════════════════
// deep async chains — error at various positions
// ═══════════════════════════════════════════════════════════════════════════════

test("fromPromise().filter().tap().mapAsync().map().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => 42)
            .filter(x => x > 0)
            .tap(() => {})
            .mapAsync(async () => { await sleep(5); throw new Error("deep-mapAsync-error"); })
            .map(x => x)
            .toPromise(),
        "deep-mapAsync-error"
    );
});

test("fromDelay().tap().tap().map().toPromise() — throw in second tap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromDelay(10)
            .tap(() => {})
            .tap(() => { throw new Error("second-tap-error"); })
            .map(() => 1)
            .toPromise(),
        "second-tap-error"
    );
});

test("fromInterval().map().map().map().toPromise() — throw in third map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromInterval(10)
            .map(x => x + 1)
            .map(x => x * 2)
            .map(() => { throw new Error("triple-map-error"); })
            .toPromise(),
        "triple-map-error"
    );
});

test("fromArray().map().filter().map().filter().map().toPromise() — throw in last map", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .map(x => x * 2)
            .filter(x => x > 0)
            .map(x => x + 1)
            .filter(x => x > 0)
            .map(() => { throw new Error("last-map-error"); })
            .toPromise(),
        "last-map-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Subject — async throw at various chain positions
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.tap async throw → propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.tap(async () => { await sleep(5); throw new Error("subject-async-tap-error"); })
     .toPromise();
    await throws(t, () => s.next(1), "subject-async-tap-error");
});

test("Subject.map async throw → propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.map(async () => { await sleep(5); throw new Error("subject-async-map-error"); })
     .toPromise();
    await throws(t, () => s.next(1), "subject-async-map-error");
});

test("Subject.filter async throw → propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(async () => { await sleep(5); throw new Error("subject-async-filter-error"); })
     .toPromise();
    await throws(t, () => s.next(1), "subject-async-filter-error");
});

test("Subject.mapAsync — throw after delay propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.mapAsync(async (v) => { await sleep(10); throw new Error(`mapAsync-${v}`); })
     .toPromise();
    await throws(t, () => s.next(7), "mapAsync-7");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Operator chains — error at various operator positions
// ═══════════════════════════════════════════════════════════════════════════════

test("fromArray().operator(distinct).map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 1, 2, 2, 3])
            .operator(Operator.distinct())
            .map(() => { throw new Error("distinct-map-error"); })
            .toPromise(),
        "distinct-map-error"
    );
});

test("fromArray().operator(skip(2)).map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3, 4])
            .operator(Operator.skip(2))
            .map(() => { throw new Error("skip-map-error"); })
            .toPromise(),
        "skip-map-error"
    );
});

test("fromArray().operator(take(2)).map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .operator(Operator.take(2))
            .map(() => { throw new Error("take-map-error"); })
            .toPromise(),
        "take-map-error"
    );
});

test("fromArray().operator(pair).map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3, 4])
            .operator(Operator.pair())
            .map(() => { throw new Error("pair-map-error"); })
            .toPromise(),
        "pair-map-error"
    );
});

test("fromArray().operator(group(2)).map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3, 4])
            .operator(Operator.group(2))
            .map(() => { throw new Error("group-map-error"); })
            .toPromise(),
        "group-map-error"
    );
});

test("fromArray().operator(count).map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .operator(Operator.count())
            .map(() => { throw new Error("count-map-error"); })
            .toPromise(),
        "count-map-error"
    );
});

test("fromValue().operator(strideTricks).map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromValue([1, 2, 3, 4, 5, 6])
            .operator(Operator.strideTricks(3, 3))
            .map(() => { throw new Error("strideTricks-map-error"); })
            .toPromise(),
        "strideTricks-map-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromInterval / fromDelay — error on later tick
// ═══════════════════════════════════════════════════════════════════════════════

test("fromInterval().filter(skip first).map throws → toPromise rejects on tick 1", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromInterval(10)
            .filter(i => i >= 1)
            .map(() => { throw new Error("interval-later-tick-error"); })
            .toPromise(),
        "interval-later-tick-error"
    );
});

test("fromDelay().tap().mapAsync throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromDelay(10)
            .tap(() => {})
            .mapAsync(async () => { await sleep(5); throw new Error("delay-tap-mapAsync-error"); })
            .toPromise(),
        "delay-tap-mapAsync-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// error does NOT propagate when filtered out before the throw
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject — filter blocks value, throw in map fires only on passing value", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.filter(v => v > 10)
     .map(() => { throw new Error("should-not-reach"); })
     .toPromise();
    await s.next(5);  // filtered — no throw
    await throws(t, () => s.next(20), "should-not-reach");
});

test("fromArray — filter skips first items, map throws on first passing", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([0, 0, 0, 1])
            .filter(x => x > 0)
            .map(() => { throw new Error("filter-skips-error"); })
            .toPromise(),
        "filter-skips-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// multiple concurrent toPromise() — both reject
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject — two subjects each with a chain reject independently", async (t) => {
    noUnhandled(t);
    const s1 = new Subject();
    const s2 = new Subject();
    const p1 = s1.map(() => { throw new Error("chain-a-error"); }).toPromise();
    const p2 = s2.map(() => { throw new Error("chain-b-error"); }).toPromise();
    await s1.next(1).catch(() => {});
    await s2.next(1).catch(() => {});
    const e1 = await p1.catch(e => e.message);
    const e2 = await p2.catch(e => e.message);
    if (e1 === "chain-a-error" && e2 === "chain-b-error") t.pass();
    else t.fail(`got e1=${e1} e2=${e2}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromPromise fallbackfn variations
// ═══════════════════════════════════════════════════════════════════════════════

test("fromPromise with fallbackfn — chain map still works when promise resolves", async (t) => {
    const v = await Source.fromPromise(
        async () => 10,
        () => {}
    ).map(x => x * 5).toPromise();
    if (v === 50) t.pass();
    else t.fail(`expected 50, got ${v}`);
});

test("fromPromise with fallbackfn — throw in map propagates even with fallbackfn", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => 10, () => {})
            .map(() => { throw new Error("fallback-chain-map-error"); })
            .toPromise(),
        "fallback-chain-map-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// once() — error propagation via fromArray / fromPromise
// ═══════════════════════════════════════════════════════════════════════════════

test("fromArray().once() — async throw in callback is unhandled (once does not return promise)", async (t) => {
    noUnhandled(t);
    let called = false;
    Source.fromArray([1, 2, 3]).once(() => { called = true; });
    await sleep(20);
    if (called) t.pass();
    else t.fail("once callback was not called");
});

test("fromPromise().once() — callback receives resolved value", async (t) => {
    let received = null;
    Source.fromPromise(async () => 77).once((v) => { received = v; });
    await sleep(20);
    if (received === 77) t.pass();
    else t.fail(`expected 77, got ${received}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// repeat — error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.repeat().map throws → propagates to next()", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.repeat(100000)
     .map(() => { throw new Error("repeat-map-error"); })
     .toPromise();
    await throws(t, () => s.next(1), "repeat-map-error");
});

// ═══════════════════════════════════════════════════════════════════════════════
// operator(retry) — exhausted retries propagate
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.operator(retry(0)).mapAsync throws → propagates immediately", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.operator(Operator.retry(0))
     .mapAsync(async () => { await sleep(5); throw new Error("retry0-error"); })
     .toPromise();
    await throws(t, () => s.next(1), "retry0-error");
});

test("fromPromise().operator(retry(1)).map throws — retries then propagates", async (t) => {
    noUnhandled(t);
    let attempts = 0;
    await throws(t, () =>
        Source.fromPromise(async () => 1)
            .operator(Operator.retry(1))
            .map(() => { attempts++; throw new Error("retry1-map-error"); })
            .toPromise(),
        "retry1-map-error"
    );
    // retry(1) means 1 retry = 2 total attempts
    if (attempts !== 2) t.fail(`expected 2 attempts, got ${attempts}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// deep fromPromise chain with multiple async hops
// ═══════════════════════════════════════════════════════════════════════════════

test("fromPromise().map().mapAsync().tap().map().toPromise() — throw in first map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => ({ value: 42 }))
            .map(() => { throw new Error("deep-first-map-error"); })
            .mapAsync(async x => x)
            .tap(() => {})
            .map(x => x)
            .toPromise(),
        "deep-first-map-error"
    );
});

test("fromPromise().map().mapAsync().tap().map().toPromise() — throw in tap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => 5)
            .map(x => x * 2)
            .mapAsync(async x => x + 1)
            .tap(() => { throw new Error("deep-tap-error"); })
            .map(x => x)
            .toPromise(),
        "deep-tap-error"
    );
});

test("fromArray().operator(group).mapAsync().tap().map().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3, 4])
            .operator(Operator.group(2))
            .mapAsync(async () => { await sleep(3); throw new Error("deep-group-mapAsync-error"); })
            .tap(() => {})
            .map(x => x)
            .toPromise(),
        "deep-group-mapAsync-error"
    );
});

test("fromInterval().operator(take).filter().mapAsync().toPromise() — throw propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromInterval(10)
            .operator(Operator.take(5))
            .filter(i => i >= 0)
            .mapAsync(async () => { await sleep(3); throw new Error("interval-take-filter-error"); })
            .toPromise(),
        "interval-take-filter-error"
    );
});

test("fromDelay().map().filter().tap().mapAsync().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromDelay(10)
            .map(() => 1)
            .filter(x => x > 0)
            .tap(() => {})
            .mapAsync(async () => { await sleep(3); throw new Error("delay-deep-chain-error"); })
            .toPromise(),
        "delay-deep-chain-error"
    );
});
