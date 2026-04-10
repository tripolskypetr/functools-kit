import { test } from "worker-testbed";
import { Operator, Subject } from "../../../build/index.mjs";

test("Operator.take: first N values", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.take(3)).connect((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    await s.next(3);
    await s.next(4);
    unsub();
    if (results.length === 3 && results[0] === 1 && results[1] === 2 && results[2] === 3) {
        t.pass();
    } else {
        t.fail(`expected [1,2,3], got ${JSON.stringify(results)}`);
    }
});

test("Operator.skip: skip first N values", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.skip(2)).connect((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    await s.next(3);
    await s.next(4);
    unsub();
    if (results.length === 2 && results[0] === 3 && results[1] === 4) {
        t.pass();
    } else {
        t.fail(`expected [3,4], got ${JSON.stringify(results)}`);
    }
});

test("Operator.pair: sliding window of 2", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.pair()).connect((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    await s.next(3);
    await s.next(4);
    unsub();
    const ok = results.length === 3
        && JSON.stringify(results[0]) === JSON.stringify([1, 2])
        && JSON.stringify(results[1]) === JSON.stringify([2, 3])
        && JSON.stringify(results[2]) === JSON.stringify([3, 4]);
    if (ok) {
        t.pass();
    } else {
        t.fail(`expected [[1,2],[2,3],[3,4]], got ${JSON.stringify(results)}`);
    }
});

test("Operator.group: chunks of N", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.group(3)).connect((v) => results.push(v));
    await s.next(1); await s.next(2); await s.next(3);
    await s.next(4); await s.next(5); await s.next(6);
    unsub();
    const ok = results.length === 2
        && JSON.stringify(results[0]) === JSON.stringify([1, 2, 3])
        && JSON.stringify(results[1]) === JSON.stringify([4, 5, 6]);
    if (ok) {
        t.pass();
    } else {
        t.fail(`expected [[1,2,3],[4,5,6]], got ${JSON.stringify(results)}`);
    }
});

test("Operator.group: incomplete chunk not emitted", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.group(3)).connect((v) => results.push(v));
    await s.next(1); await s.next(2);
    unsub();
    if (results.length === 0) {
        t.pass();
    } else {
        t.fail(`expected [], got ${JSON.stringify(results)}`);
    }
});

test("Operator.distinct: filters consecutive duplicates", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.distinct()).connect((v) => results.push(v));
    await s.next(1); await s.next(1); await s.next(2); await s.next(2); await s.next(1);
    unsub();
    if (results.length === 3 && results[0] === 1 && results[1] === 2 && results[2] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1,2,1], got ${JSON.stringify(results)}`);
    }
});

test("Operator.distinct: custom compare key", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver()
        .operator(Operator.distinct((x) => x.id))
        .connect((v) => results.push(v));
    await s.next({ id: 1, v: "a" });
    await s.next({ id: 1, v: "b" });
    await s.next({ id: 2, v: "c" });
    unsub();
    if (results.length === 2 && results[0].id === 1 && results[1].id === 2) {
        t.pass();
    } else {
        t.fail(`expected 2 items with ids [1,2], got ${JSON.stringify(results)}`);
    }
});

test("Operator.count: counts consecutive equal values", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.count()).connect((v) => results.push(v));
    await s.next(1); await s.next(1); await s.next(1); await s.next(2);
    unsub();
    const counts = results.map((r) => r.count);
    const values = results.map((r) => r.value);
    const okCounts = JSON.stringify(counts) === JSON.stringify([0, 1, 2, 0]);
    const okValues = JSON.stringify(values) === JSON.stringify([1, 1, 1, 2]);
    if (okCounts && okValues) {
        t.pass();
    } else {
        t.fail(`counts=${JSON.stringify(counts)} values=${JSON.stringify(values)}`);
    }
});

test("Operator.retry: succeeds on first try", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.retry(3)).connect((v) => results.push(v));
    await s.next(1);
    unsub();
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("Operator.retry: retries and succeeds before exhaustion", async (t) => {
    const s = new Subject();
    const results = [];
    let attempts = 0;
    const unsub = s.toObserver().operator(Operator.retry(3)).connect((v) => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        results.push(v);
    });
    await s.next(42);
    unsub();
    if (results.length === 1 && results[0] === 42 && attempts === 3) {
        t.pass();
    } else {
        t.fail(`attempts=${attempts} results=${JSON.stringify(results)}`);
    }
});

test("Operator.retry: throws after exhausting attempts", async (t) => {
    const s = new Subject();
    let attempts = 0;
    const unsub = s.toObserver().operator(Operator.retry(2)).connect(() => {
        attempts++;
        throw new Error("always fails");
    });
    try {
        await s.next(7);
        unsub();
        t.fail("should have thrown");
    } catch (e) {
        unsub();
        if (e instanceof Error && e.message === "always fails" && attempts === 3) {
            t.pass();
        } else {
            t.fail(`attempts=${attempts} error=${e}`);
        }
    }
});

test("Operator.retry: async subscriber retries and succeeds", async (t) => {
    const s = new Subject();
    const results = [];
    let attempts = 0;
    const unsub = s.toObserver().operator(Operator.retry(3)).connect(async (v) => {
        attempts++;
        if (attempts < 2) throw new Error("async fail");
        results.push(v);
    });
    await s.next(99);
    unsub();
    if (results.length === 1 && results[0] === 99 && attempts === 2) {
        t.pass();
    } else {
        t.fail(`attempts=${attempts} results=${JSON.stringify(results)}`);
    }
});

test("Operator.retry: async subscriber throws after exhaustion", async (t) => {
    const s = new Subject();
    let attempts = 0;
    const unsub = s.toObserver().operator(Operator.retry(1)).connect(async () => {
        attempts++;
        throw new Error("async always fails");
    });
    try {
        await s.next(5);
        unsub();
        t.fail("should have thrown");
    } catch (e) {
        unsub();
        if (e instanceof Error && e.message === "async always fails" && attempts === 2) {
            t.pass();
        } else {
            t.fail(`attempts=${attempts} error=${e}`);
        }
    }
});

test("Operator.strideTricks: non-overlapping strides", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.strideTricks(3, 3)).connect((v) => results.push(v));
    await s.next([1, 2, 3, 4, 5, 6]);
    unsub();
    const ok = results.length === 1
        && JSON.stringify(results[0]) === JSON.stringify([[1, 2, 3], [4, 5, 6]]);
    if (ok) {
        t.pass();
    } else {
        t.fail(`expected [[[1,2,3],[4,5,6]]], got ${JSON.stringify(results)}`);
    }
});
