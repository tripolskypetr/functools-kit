import { test } from "worker-testbed";
import { Source, Subject } from "../../../build/index.mjs";

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
    if (results[0] === 2 && results[1] === 4 && results[2] === 6) {
        t.pass();
    } else {
        t.fail(`expected [2,4,6], got ${JSON.stringify(results)}`);
    }
});

test("Observer: filter", async (t) => {
    const results = await collect(Source.fromArray([1, 2, 3, 4]).filter((x) => x % 2 === 0), 2);
    if (results[0] === 2 && results[1] === 4) {
        t.pass();
    } else {
        t.fail(`expected [2,4], got ${JSON.stringify(results)}`);
    }
});

test("Observer: tap side-effect, value passes through", async (t) => {
    const side = [];
    const results = await collect(Source.fromArray([1, 2]).tap((x) => side.push(x)), 2);
    if (side[0] === 1 && side[1] === 2 && results[0] === 1 && results[1] === 2) {
        t.pass();
    } else {
        t.fail(`side=${JSON.stringify(side)} results=${JSON.stringify(results)}`);
    }
});

test("Observer: reduce accumulates", async (t) => {
    const results = await collect(
        Source.fromArray([1, 2, 3, 4]).reduce((a, c) => a + c, 0), 4
    );
    if (results[0] === 1 && results[1] === 3 && results[2] === 6 && results[3] === 10) {
        t.pass();
    } else {
        t.fail(`expected [1,3,6,10], got ${JSON.stringify(results)}`);
    }
});

test("Observer: flatMap", async (t) => {
    const results = await collect(
        Source.fromArray([1, 2]).flatMap((x) => [x, x * 10]), 4
    );
    if (results[0] === 1 && results[1] === 10 && results[2] === 2 && results[3] === 20) {
        t.pass();
    } else {
        t.fail(`expected [1,10,2,20], got ${JSON.stringify(results)}`);
    }
});

test("Observer: split flattens arrays", async (t) => {
    const results = await collect(Source.fromValue([1, [2, 3]]).split(), 3);
    if (results[0] === 1 && results[1] === 2 && results[2] === 3) {
        t.pass();
    } else {
        t.fail(`expected [1,2,3], got ${JSON.stringify(results)}`);
    }
});

test("Observer: mapAsync", async (t) => {
    const results = await collect(
        Source.fromArray([1, 2, 3]).mapAsync(async (x) => x * 10), 3
    );
    if (results[0] === 10 && results[1] === 20 && results[2] === 30) {
        t.pass();
    } else {
        t.fail(`expected [10,20,30], got ${JSON.stringify(results)}`);
    }
});

test("Observer: merge", async (t) => {
    const results = await collect(Source.fromValue(1).merge(Source.fromValue(2)), 2);
    const sorted = [...results].sort();
    if (sorted[0] === 1 && sorted[1] === 2) {
        t.pass();
    } else {
        t.fail(`expected [1,2], got ${JSON.stringify(results)}`);
    }
});

test("Observer: once fires once (via Subject)", async (t) => {
    const s = new Subject();
    const results = [];
    s.toObserver().once((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("Observer: toPromise resolves first value (async source)", async (t) => {
    const s = new Subject();
    const p = s.toObserver().toPromise();
    await s.next(42);
    const v = await p;
    if (v === 42) {
        t.pass();
    } else {
        t.fail(`expected 42, got ${v}`);
    }
});

test("Observer: connect unsubscribe stops delivery", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().connect((v) => results.push(v));
    await s.next(1);
    unsub();
    await s.next(2);
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
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
    if (results.length === 1 && results[0] === 3) {
        t.pass();
    } else {
        t.fail(`expected [3], got ${JSON.stringify(results)}`);
    }
});

test("Observer: delay defers emission", async (t) => {
    const start = Date.now();
    await Source.fromValue(1).delay(50).toPromise();
    if (Date.now() - start >= 45) {
        t.pass();
    } else {
        t.fail(`delay too short: ${Date.now() - start}ms`);
    }
});

test("Observer: repeat re-emits on interval", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.toObserver().repeat(20).connect((v) => results.push(v));
    await s.next(1);
    await new Promise((r) => setTimeout(r, 70));
    unsub();
    if (results.length >= 3) {
        t.pass();
    } else {
        t.fail(`expected >= 3 emissions, got ${results.length}`);
    }
});

test("Observer: unsubscribe disposes chain", async (t) => {
    const s = new Subject();
    const results = [];
    const obs = s.toObserver().map((x) => x + 1);
    const unsub = obs.connect((v) => results.push(v));
    await s.next(1);
    unsub();
    await s.next(2);
    if (results.length === 1 && results[0] === 2) {
        t.pass();
    } else {
        t.fail(`expected [2], got ${JSON.stringify(results)}`);
    }
});
