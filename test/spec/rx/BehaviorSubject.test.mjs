import { test } from "tape";
import { BehaviorSubject } from "../../../build/index.mjs";

test("BehaviorSubject: stores initial value", (t) => {
    const s = new BehaviorSubject(10);
    t.equal(s.data, 10);
    t.end();
});

test("BehaviorSubject: next updates data", async (t) => {
    const s = new BehaviorSubject(1);
    await s.next(2);
    t.equal(s.data, 2);
});

test("BehaviorSubject: replays current value on toObserver connect", async (t) => {
    const s = new BehaviorSubject(42);
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    t.deepEqual(results, [42]);
});

test("BehaviorSubject: null initial value not replayed", async (t) => {
    const s = new BehaviorSubject(null);
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    t.deepEqual(results, []);
});

test("BehaviorSubject: late subscriber gets current then live", async (t) => {
    const s = new BehaviorSubject(1);
    await s.next(2);
    const results = [];
    s.toObserver().connect((v) => results.push(v));
    await s.next(3);
    t.deepEqual(results, [2, 3]);
});

test("BehaviorSubject: subscribe receives only new values", async (t) => {
    const s = new BehaviorSubject(5);
    const results = [];
    s.subscribe((v) => results.push(v));
    await s.next(6);
    await s.next(7);
    t.deepEqual(results, [6, 7]);
});
