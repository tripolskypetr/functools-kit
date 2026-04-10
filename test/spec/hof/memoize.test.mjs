import { test } from "worker-testbed";
import { memoize } from "../../../build/index.mjs";

test("memoize: caches result by key", (t) => {
    let calls = 0;
    const fn = memoize(([x]) => x, (x) => { calls++; return x * 2; });
    fn(3); fn(3);
    if (calls === 1) {
        t.pass();
    } else {
        t.fail(`expected 1 call, got ${calls}`);
    }
});

test("memoize: different keys compute separately", (t) => {
    let calls = 0;
    const fn = memoize(([x]) => x, (x) => { calls++; return x * 2; });
    const a = fn(3);
    const b = fn(5);
    if (a === 6 && b === 10 && calls === 2) {
        t.pass();
    } else {
        t.fail(`a=${a} b=${b} calls=${calls}`);
    }
});

test("memoize: clear all removes all keys", (t) => {
    let calls = 0;
    const fn = memoize(([x]) => x, (x) => { calls++; return x; });
    fn(1); fn(2);
    fn.clear();
    fn(1); fn(2);
    if (calls === 4) {
        t.pass();
    } else {
        t.fail(`expected 4 calls, got ${calls}`);
    }
});

test("memoize: clear by key removes only that key", (t) => {
    let calls = 0;
    const fn = memoize(([x]) => x, (x) => { calls++; return x; });
    fn(1); fn(2);
    fn.clear(1);
    fn(1); fn(2);
    if (calls === 3) {
        t.pass();
    } else {
        t.fail(`expected 3 calls, got ${calls}`);
    }
});

test("memoize: has/get/add/remove/values/keys", (t) => {
    const fn = memoize(([x]) => x, (x) => x * 10);
    fn(1); fn(2);
    if (!fn.has(1) || !fn.has(2)) { t.fail("has failed"); return; }
    if (fn.get(1) !== 10 || fn.get(2) !== 20) { t.fail("get failed"); return; }
    fn.add(3, 99);
    if (fn.get(3) !== 99) { t.fail("add failed"); return; }
    fn.remove(3);
    if (fn.has(3)) { t.fail("remove failed"); return; }
    const vals = fn.values().sort((a, b) => a - b);
    if (vals[0] !== 10 || vals[1] !== 20) { t.fail(`values failed: ${JSON.stringify(vals)}`); return; }
    const keys = fn.keys().sort((a, b) => a - b);
    if (keys[0] !== 1 || keys[1] !== 2) { t.fail(`keys failed: ${JSON.stringify(keys)}`); return; }
    t.pass();
});
