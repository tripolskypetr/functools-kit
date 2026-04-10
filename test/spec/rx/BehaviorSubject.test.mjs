import { test } from "worker-testbed";
import { BehaviorSubject } from "../../../build/index.mjs";

test("BehaviorSubject: stores initial value", (t) => {
    const s = new BehaviorSubject(10);
    if (s.data === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${s.data}`);
    }
});

test("BehaviorSubject: next updates data", async (t) => {
    const s = new BehaviorSubject(1);
    await s.next(2);
    if (s.data === 2) {
        t.pass();
    } else {
        t.fail(`expected 2, got ${s.data}`);
    }
});

test("BehaviorSubject: replays current value on toObserver connect", async (t) => {
    const s = new BehaviorSubject(42);
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    if (results.length === 1 && results[0] === 42) {
        t.pass();
    } else {
        t.fail(`expected [42], got ${JSON.stringify(results)}`);
    }
});

test("BehaviorSubject: null initial value not replayed", async (t) => {
    const s = new BehaviorSubject(null);
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    if (results.length === 0) {
        t.pass();
    } else {
        t.fail(`expected [], got ${JSON.stringify(results)}`);
    }
});

test("BehaviorSubject: late subscriber gets current then live", async (t) => {
    const s = new BehaviorSubject(1);
    await s.next(2);
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    await s.next(3);
    if (results[0] === 2 && results[1] === 3 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [2,3], got ${JSON.stringify(results)}`);
    }
});

test("BehaviorSubject: subscribe receives only new values", async (t) => {
    const s = new BehaviorSubject(5);
    const results = [];
    s.subscribe((v) => results.push(v));
    await s.next(6);
    await s.next(7);
    if (results[0] === 6 && results[1] === 7 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [6,7], got ${JSON.stringify(results)}`);
    }
});
