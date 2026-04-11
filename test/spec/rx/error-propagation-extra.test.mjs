import { test } from "worker-testbed";
import { Subject, Source, Operator, sleep } from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// merge() — error propagation from both sides
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.merge — throw in left branch propagates to next()", async (t) => {
    const left = new Subject();
    const right = new Subject();
    const p = left.merge(right)
                  .map(() => { throw new Error("merge-left-error"); })
                  .toPromise();
    left.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "merge-left-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("Subject.merge(fromArray) — throw in map propagates on right-branch value", async (t) => {
    try {
        await Source.fromArray([1])
            .merge(Source.fromArray([2]))
            .map(() => { throw new Error("merge-right-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "merge-right-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray.merge(fromArray) — throw in map propagates", async (t) => {
    try {
        await Source.fromArray([1, 2])
            .merge(Source.fromArray([3, 4]))
            .map(() => { throw new Error("merge-fromArray-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "merge-fromArray-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromPromise.merge(fromDelay) — left rejects, propagates via toPromise", async (t) => {
    try {
        await Source.fromPromise(async () => { throw new Error("merge-promise-left-error"); })
            .merge(Source.fromDelay(100000))
            .map(x => x)
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "merge-promise-left-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// flatMap — error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.flatMap — throw in flatMap propagates to next()", async (t) => {
    const s = new Subject();
    const p = s.flatMap(() => { throw new Error("flatMap-error"); })
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "flatMap-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().flatMap().map().toPromise() — throw in map propagates", async (t) => {
    try {
        await Source.fromArray([1, 2, 3])
            .flatMap(x => [x, x * 10])
            .map(() => { throw new Error("flatMap-chain-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "flatMap-chain-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromValue().flatMap().toPromise() — throw in flatMap propagates", async (t) => {
    try {
        await Source.fromValue(5)
            .flatMap(() => { throw new Error("fromValue-flatMap-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "fromValue-flatMap-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// split — error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.split().map().toPromise() — throw in map propagates", async (t) => {
    const s = new Subject();
    const p = s.split()
               .map(() => { throw new Error("split-map-error"); })
               .toPromise();
    s.next([1, 2, 3]).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "split-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().split().map().toPromise() — throw propagates", async (t) => {
    try {
        await Source.fromArray([[1, 2], [3, 4]])
            .split()
            .map(() => { throw new Error("split-fromArray-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "split-fromArray-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromValue().split().filter().map().toPromise() — throw propagates", async (t) => {
    try {
        await Source.fromValue([1, 2, 3])
            .split()
            .filter(x => x > 0)
            .map(() => { throw new Error("split-filter-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "split-filter-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// reduce — error propagation
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.reduce — async throw in accumulator propagates", async (t) => {
    const s = new Subject();
    const p = s.reduce(async () => { await sleep(5); throw new Error("reduce-async-error"); }, 0)
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "reduce-async-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().reduce().map().toPromise() — throw in map propagates", async (t) => {
    try {
        await Source.fromArray([1, 2, 3])
            .reduce((a, v) => a + v, 0)
            .map(() => { throw new Error("reduce-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "reduce-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("Subject.reduce — sync throw in accumulator propagates", async (t) => {
    const s = new Subject();
    const p = s.reduce(() => { throw new Error("reduce-sync-error"); }, 0)
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "reduce-sync-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// deep async chains — error at various positions
// ═══════════════════════════════════════════════════════════════════════════════

test("fromPromise().filter().tap().mapAsync().map().toPromise() — throw in mapAsync propagates", async (t) => {
    try {
        await Source.fromPromise(async () => 42)
            .filter(x => x > 0)
            .tap(() => {})
            .mapAsync(async () => { await sleep(5); throw new Error("deep-mapAsync-error"); })
            .map(x => x)
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "deep-mapAsync-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromDelay().tap().tap().map().toPromise() — throw in second tap propagates", async (t) => {
    try {
        await Source.fromDelay(10)
            .tap(() => {})
            .tap(() => { throw new Error("second-tap-error"); })
            .map(() => 1)
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "second-tap-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromInterval().map().map().map().toPromise() — throw in third map propagates", async (t) => {
    try {
        await Source.fromInterval(10)
            .map(x => x + 1)
            .map(x => x * 2)
            .map(() => { throw new Error("triple-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "triple-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().map().filter().map().filter().map().toPromise() — throw in last map", async (t) => {
    try {
        await Source.fromArray([1, 2, 3])
            .map(x => x * 2)
            .filter(x => x > 0)
            .map(x => x + 1)
            .filter(x => x > 0)
            .map(() => { throw new Error("last-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "last-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Subject — async throw at various chain positions
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.tap async throw → propagates to toPromise()", async (t) => {
    const s = new Subject();
    const p = s.tap(async () => { await sleep(5); throw new Error("subject-async-tap-error"); })
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "subject-async-tap-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("Subject.map async throw → propagates to toPromise()", async (t) => {
    const s = new Subject();
    const p = s.map(async () => { await sleep(5); throw new Error("subject-async-map-error"); })
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "subject-async-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("Subject.filter async throw → propagates to toPromise()", async (t) => {
    const s = new Subject();
    const p = s.filter(async () => { await sleep(5); throw new Error("subject-async-filter-error"); })
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "subject-async-filter-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("Subject.mapAsync — throw after delay propagates to toPromise()", async (t) => {
    const s = new Subject();
    const p = s.mapAsync(async (v) => { await sleep(10); throw new Error(`mapAsync-${v}`); })
               .toPromise();
    s.next(7).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "mapAsync-7") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Operator chains — error at various operator positions
// ═══════════════════════════════════════════════════════════════════════════════

test("fromArray().operator(distinct).map throws → toPromise rejects", async (t) => {
    try {
        await Source.fromArray([1, 1, 2, 2, 3])
            .operator(Operator.distinct())
            .map(() => { throw new Error("distinct-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "distinct-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().operator(skip(2)).map throws → toPromise rejects", async (t) => {
    try {
        await Source.fromArray([1, 2, 3, 4])
            .operator(Operator.skip(2))
            .map(() => { throw new Error("skip-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "skip-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().operator(take(2)).map throws → toPromise rejects", async (t) => {
    try {
        await Source.fromArray([1, 2, 3])
            .operator(Operator.take(2))
            .map(() => { throw new Error("take-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "take-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().operator(pair).map throws → toPromise rejects", async (t) => {
    try {
        await Source.fromArray([1, 2, 3, 4])
            .operator(Operator.pair())
            .map(() => { throw new Error("pair-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "pair-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().operator(group(2)).map throws → toPromise rejects", async (t) => {
    try {
        await Source.fromArray([1, 2, 3, 4])
            .operator(Operator.group(2))
            .map(() => { throw new Error("group-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "group-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().operator(count).map throws → toPromise rejects", async (t) => {
    try {
        await Source.fromArray([1, 2, 3])
            .operator(Operator.count())
            .map(() => { throw new Error("count-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "count-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromValue().operator(strideTricks).map throws → toPromise rejects", async (t) => {
    try {
        await Source.fromValue([1, 2, 3, 4, 5, 6])
            .operator(Operator.strideTricks(3, 3))
            .map(() => { throw new Error("strideTricks-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "strideTricks-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromInterval / fromDelay — error on later tick
// ═══════════════════════════════════════════════════════════════════════════════

test("fromInterval().filter(skip first).map throws → toPromise rejects on tick 1", async (t) => {
    try {
        await Source.fromInterval(10)
            .filter(i => i >= 1)
            .map(() => { throw new Error("interval-later-tick-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-later-tick-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromDelay().tap().mapAsync throws → toPromise rejects", async (t) => {
    try {
        await Source.fromDelay(10)
            .tap(() => {})
            .mapAsync(async () => { await sleep(5); throw new Error("delay-tap-mapAsync-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delay-tap-mapAsync-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// error does NOT propagate when filtered out before the throw
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject — filter blocks value, throw in map fires only on passing value", async (t) => {
    const s = new Subject();
    const p = s.filter(v => v > 10)
               .map(() => { throw new Error("should-not-reach"); })
               .toPromise();
    await s.next(5);  // filtered — no throw
    s.next(20).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "should-not-reach") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray — filter skips first items, map throws on first passing", async (t) => {
    try {
        await Source.fromArray([0, 0, 0, 1])
            .filter(x => x > 0)
            .map(() => { throw new Error("filter-skips-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "filter-skips-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// multiple concurrent toPromise() — both reject
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject — two subjects each with a chain reject independently", async (t) => {
    const s1 = new Subject();
    const s2 = new Subject();
    const p1 = s1.map(() => { throw new Error("chain-a-error"); }).toPromise();
    const p2 = s2.map(() => { throw new Error("chain-b-error"); }).toPromise();
    s1.next(1).catch(() => {});
    s2.next(1).catch(() => {});
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
    try {
        await Source.fromPromise(async () => 10, () => {})
            .map(() => { throw new Error("fallback-chain-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "fallback-chain-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// once() — basic behavior
// ═══════════════════════════════════════════════════════════════════════════════

test("fromArray().once() — callback is called", async (t) => {
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

test("Subject.repeat().map throws → propagates to toPromise()", async (t) => {
    const s = new Subject();
    const p = s.repeat(100000)
               .map(() => { throw new Error("repeat-map-error"); })
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "repeat-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// operator(retry) — exhausted retries propagate
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.operator(retry(0)).mapAsync throws → propagates immediately", async (t) => {
    const s = new Subject();
    const p = s.operator(Operator.retry(0))
               .mapAsync(async () => { await sleep(5); throw new Error("retry0-error"); })
               .toPromise();
    s.next(1).catch(() => {});
    try {
        await p;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "retry0-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromPromise().operator(retry(1)).map throws — retries then propagates", async (t) => {
    let attempts = 0;
    try {
        await Source.fromPromise(async () => 1)
            .operator(Operator.retry(1))
            .map(() => { attempts++; throw new Error("retry1-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "retry1-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
    // retry(1) means 1 retry = 2 total attempts
    if (attempts !== 2) t.fail(`expected 2 attempts, got ${attempts}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// deep fromPromise chain with multiple async hops
// ═══════════════════════════════════════════════════════════════════════════════

test("fromPromise().map().mapAsync().tap().map().toPromise() — throw in first map propagates", async (t) => {
    try {
        await Source.fromPromise(async () => ({ value: 42 }))
            .map(() => { throw new Error("deep-first-map-error"); })
            .mapAsync(async x => x)
            .tap(() => {})
            .map(x => x)
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "deep-first-map-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromPromise().map().mapAsync().tap().map().toPromise() — throw in tap propagates", async (t) => {
    try {
        await Source.fromPromise(async () => 5)
            .map(x => x * 2)
            .mapAsync(async x => x + 1)
            .tap(() => { throw new Error("deep-tap-error"); })
            .map(x => x)
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "deep-tap-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromArray().operator(group).mapAsync().tap().map().toPromise() — throw in mapAsync propagates", async (t) => {
    try {
        await Source.fromArray([1, 2, 3, 4])
            .operator(Operator.group(2))
            .mapAsync(async () => { await sleep(3); throw new Error("deep-group-mapAsync-error"); })
            .tap(() => {})
            .map(x => x)
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "deep-group-mapAsync-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromInterval().operator(take).filter().mapAsync().toPromise() — throw propagates", async (t) => {
    try {
        await Source.fromInterval(10)
            .operator(Operator.take(5))
            .filter(i => i >= 0)
            .mapAsync(async () => { await sleep(3); throw new Error("interval-take-filter-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-take-filter-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("fromDelay().map().filter().tap().mapAsync().toPromise() — throw in mapAsync propagates", async (t) => {
    try {
        await Source.fromDelay(10)
            .map(() => 1)
            .filter(x => x > 0)
            .tap(() => {})
            .mapAsync(async () => { await sleep(3); throw new Error("delay-deep-chain-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delay-deep-chain-error") t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});
