import { test } from "tape";
import { Source, Operator, Subject } from "../../../build/index.mjs";

const collect = (obs, n) => new Promise((resolve) => {
    const results = [];
    const state = { unsub: () => {} };
    state.unsub = obs.connect((v) => {
        results.push(v);
        if (results.length === n) { state.unsub(); resolve(results); }
    });
});

test("Operator.take: first N values", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.take(3)).connect((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    await s.next(3);
    await s.next(4);
    unsub();
    t.deepEqual(results, [1, 2, 3]);
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
    t.deepEqual(results, [3, 4]);
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
    t.deepEqual(results, [[1, 2], [2, 3], [3, 4]]);
});

test("Operator.group: chunks of N", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.group(3)).connect((v) => results.push(v));
    await s.next(1); await s.next(2); await s.next(3);
    await s.next(4); await s.next(5); await s.next(6);
    unsub();
    t.deepEqual(results, [[1, 2, 3], [4, 5, 6]]);
});

test("Operator.group: incomplete chunk not emitted", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.group(3)).connect((v) => results.push(v));
    await s.next(1); await s.next(2);
    unsub();
    t.deepEqual(results, []);
});

test("Operator.distinct: filters consecutive duplicates", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.distinct()).connect((v) => results.push(v));
    await s.next(1); await s.next(1); await s.next(2); await s.next(2); await s.next(1);
    unsub();
    t.deepEqual(results, [1, 2, 1]);
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
    t.equal(results.length, 2);
    t.equal(results[0].id, 1);
    t.equal(results[1].id, 2);
});

test("Operator.count: counts consecutive equal values", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.count()).connect((v) => results.push(v));
    await s.next(1); await s.next(1); await s.next(1); await s.next(2);
    unsub();
    t.deepEqual(results.map((r) => r.count), [0, 1, 2, 0]);
    t.deepEqual(results.map((r) => r.value), [1, 1, 1, 2]);
});

test("Operator.strideTricks: non-overlapping strides", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().operator(Operator.strideTricks(3, 3)).connect((v) => results.push(v));
    await s.next([1, 2, 3, 4, 5, 6]);
    unsub();
    t.equal(results.length, 1);
    t.deepEqual(results[0], [[1, 2, 3], [4, 5, 6]]);
});
