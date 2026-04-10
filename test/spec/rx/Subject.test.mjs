import { test } from "worker-testbed";
import { Subject } from "../../../build/index.mjs";

test("Subject: next delivers to subscribers", async (t) => {
    const s = new Subject();
    const results = [];
    s.subscribe((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    if (results[0] === 1 && results[1] === 2 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [1,2], got ${JSON.stringify(results)}`);
    }
});

test("Subject: subscribe returns unsubscribe", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = s.subscribe((v) => results.push(v));
    await s.next(1);
    unsub();
    await s.next(2);
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("Subject: hasListeners", (t) => {
    const s = new Subject();
    if (s.hasListeners !== false) { t.fail("should be false before subscribe"); return; }
    const unsub = s.subscribe(() => {});
    if (s.hasListeners !== true) { t.fail("should be true after subscribe"); return; }
    unsub();
    t.pass();
});

test("Subject: unsubscribeAll", async (t) => {
    const s = new Subject();
    const results = [];
    s.subscribe((v) => results.push(v));
    s.subscribe((v) => results.push(v));
    s.unsubscribeAll();
    await s.next(1);
    if (results.length === 0) {
        t.pass();
    } else {
        t.fail(`expected [], got ${JSON.stringify(results)}`);
    }
});

test("Subject: once fires exactly once", async (t) => {
    const s = new Subject();
    const results = [];
    s.once((v) => results.push(v));
    await s.next(1);
    await s.next(2);
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("Subject: multiple subscribers all receive", async (t) => {
    const s = new Subject();
    const a = [], b = [];
    s.subscribe((v) => a.push(v));
    s.subscribe((v) => b.push(v));
    await s.next(5);
    if (a[0] === 5 && b[0] === 5) {
        t.pass();
    } else {
        t.fail(`a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
    }
});

test("Subject: map", async (t) => {
    const s = new Subject();
    const results = [];
    s.map((x) => x * 2).connect((v) => results.push(v));
    await s.next(3);
    await s.next(5);
    if (results[0] === 6 && results[1] === 10 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [6,10], got ${JSON.stringify(results)}`);
    }
});

test("Subject: filter", async (t) => {
    const s = new Subject();
    const results = [];
    s.filter((x) => x > 2).connect((v) => results.push(v));
    await s.next(1);
    await s.next(3);
    await s.next(4);
    if (results[0] === 3 && results[1] === 4 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [3,4], got ${JSON.stringify(results)}`);
    }
});

test("Subject: toObserver delivers values", async (t) => {
    const s = new Subject();
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    await s.next(42);
    if (results.length === 1 && results[0] === 42) {
        t.pass();
    } else {
        t.fail(`expected [42], got ${JSON.stringify(results)}`);
    }
});

test("Subject: toPromise resolves on first next", async (t) => {
    const s = new Subject();
    const p = s.toPromise();
    await s.next(99);
    const v = await p;
    if (v === 99) {
        t.pass();
    } else {
        t.fail(`expected 99, got ${v}`);
    }
});
