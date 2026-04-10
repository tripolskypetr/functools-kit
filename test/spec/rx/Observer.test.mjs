import { test } from "tape";
import { Source, Subject } from "../../../build/index.mjs";

// collect N emissions, safe for synchronous sources
const collect = (obs, n) => new Promise((resolve) => {
    const results = [];
    const state = { unsub: () => {} };
    state.unsub = obs.connect((v) => {
        results.push(v);
        if (results.length === n) { state.unsub(); resolve(results); }
    });
});

test("Observer: map", async (t) => {
    const results = await collect(Source.fromArray([1, 2, 3]).map((x) => x * 2), 3);
    t.deepEqual(results, [2, 4, 6]);
});

test("Observer: filter", async (t) => {
    const results = await collect(Source.fromArray([1, 2, 3, 4]).filter((x) => x % 2 === 0), 2);
    t.deepEqual(results, [2, 4]);
});

test("Observer: tap side-effect, value passes through", async (t) => {
    const side = [];
    const results = await collect(Source.fromArray([1, 2]).tap((x) => side.push(x)), 2);
    t.deepEqual(side, [1, 2]);
    t.deepEqual(results, [1, 2]);
});

test("Observer: reduce accumulates", async (t) => {
    const results = await collect(
        Source.fromArray([1, 2, 3, 4]).reduce((a, c) => a + c, 0), 4
    );
    t.deepEqual(results, [1, 3, 6, 10]);
});

test("Observer: flatMap", async (t) => {
    const results = await collect(
        Source.fromArray([1, 2]).flatMap((x) => [x, x * 10]), 4
    );
    t.deepEqual(results, [1, 10, 2, 20]);
});

test("Observer: split flattens arrays", async (t) => {
    const results = await collect(Source.fromValue([1, [2, 3]]).split(), 3);
    t.deepEqual(results, [1, 2, 3]);
});

test("Observer: mapAsync", async (t) => {
    const results = await collect(
        Source.fromArray([1, 2, 3]).mapAsync(async (x) => x * 10), 3
    );
    t.deepEqual(results, [10, 20, 30]);
});

test("Observer: merge", async (t) => {
    const results = await collect(Source.fromValue(1).merge(Source.fromValue(2)), 2);
    t.deepEqual(results.sort(), [1, 2]);
});

test("Observer: once fires once (via Subject)", async (t) => {
    const s = new Subject();
    const results = [];
    s.toObserver().once((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    t.deepEqual(results, [1]);
});

test("Observer: toPromise resolves first value (async source)", async (t) => {
    const s = new Subject();
    const p = s.toObserver().toPromise();
    await s.next(42);
    const v = await p;
    t.equal(v, 42);
});

test("Observer: connect unsubscribe stops delivery", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().connect((v) => results.push(v));
    await s.next(1);
    unsub();
    await s.next(2);
    t.deepEqual(results, [1]);
});

test("Observer: debounce emits last value after quiet", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().debounce(40).connect((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    await s.next(3);
    await new Promise((r) => setTimeout(r, 80));
    unsub();
    t.equal(results.length, 1);
    t.equal(results[0], 3);
});

test("Observer: delay defers emission", async (t) => {
    const start = Date.now();
    await Source.fromValue(1).delay(50).toPromise();
    t.ok(Date.now() - start >= 45);
});

test("Observer: repeat re-emits on interval", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().repeat(20).connect((v) => results.push(v));
    await s.next(1);
    await new Promise((r) => setTimeout(r, 70));
    unsub();
    t.ok(results.length >= 3, `got ${results.length}`);
});

test("Observer: unsubscribe disposes chain", async (t) => {
    const s = new Subject();
    const results = [];
    const obs = s.toObserver().map((x) => x + 1);
    const unsub = obs.connect((v) => results.push(v));
    await s.next(1);
    unsub();
    await s.next(2);
    t.deepEqual(results, [2]);
});

