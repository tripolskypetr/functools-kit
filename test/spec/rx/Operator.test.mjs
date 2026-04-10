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
