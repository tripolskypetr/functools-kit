import { test } from "tape";
import { Subject } from "../../../build/index.mjs";

test("Subject: next delivers to subscribers", async (t) => {
    const s = new Subject();
    const results = [];
    s.subscribe((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    t.deepEqual(results, [1, 2]);
});

test("Subject: subscribe returns unsubscribe", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.subscribe((v) => results.push(v));
    await s.next(1);
    unsub();
    await s.next(2);
    t.deepEqual(results, [1]);
});

test("Subject: hasListeners", (t) => {
    const s = new Subject();
    t.equal(s.hasListeners, false);
    const unsub = s.subscribe(() => {});
    t.equal(s.hasListeners, true);
    unsub();
    t.end();
});

test("Subject: unsubscribeAll", async (t) => {
    const s = new Subject();
    const results = [];
    s.subscribe((v) => results.push(v));
    s.subscribe((v) => results.push(v));
    s.unsubscribeAll();
    await s.next(1);
    t.deepEqual(results, []);
});

test("Subject: once fires exactly once", async (t) => {
    const s = new Subject();
    const results = [];
    s.once((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    t.deepEqual(results, [1]);
});

test("Subject: multiple subscribers all receive", async (t) => {
    const s = new Subject();
    const a = [], b = [];
    s.subscribe((v) => a.push(v));
    s.subscribe((v) => b.push(v));
    await s.next(5);
    t.deepEqual(a, [5]);
    t.deepEqual(b, [5]);
});

test("Subject: map", async (t) => {
    const s = new Subject();
    const results = [];
    s.map((x) => x * 2).connect((v) => results.push(v));
    await s.next(3);
    await s.next(5);
    t.deepEqual(results, [6, 10]);
});

test("Subject: filter", async (t) => {
    const s = new Subject();
    const results = [];
    s.filter((x) => x > 2).connect((v) => results.push(v));
    await s.next(1);
    await s.next(3);
    await s.next(4);
    t.deepEqual(results, [3, 4]);
});

test("Subject: toObserver delivers values", async (t) => {
    const s = new Subject();
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    await s.next(42);
    t.deepEqual(results, [42]);
});

test("Subject: toPromise resolves on first next", async (t) => {
    const s = new Subject();
    const p = s.toPromise();
    await s.next(99);
    t.equal(await p, 99);
});
