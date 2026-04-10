import { test } from "worker-testbed";
import { ttl } from "../../../build/index.mjs";

test("ttl: returns cached value within timeout", (t) => {
    let calls = 0;
    const fn = ttl((x) => { calls++; return x * 2; }, { key: ([x]) => x, timeout: 200 });
    fn(3); fn(3);
    if (calls === 1) {
        t.pass();
    } else {
        t.fail(`expected 1 call, got ${calls}`);
    }
});

test("ttl: recomputes after timeout expires", async (t) => {
    let calls = 0;
    const fn = ttl((x) => { calls++; return x; }, { key: ([x]) => x, timeout: 30 });
    fn(1);
    await new Promise((r) => setTimeout(r, 60));
    fn(1);
    if (calls === 2) {
        t.pass();
    } else {
        t.fail(`expected 2 calls, got ${calls}`);
    }
});

test("ttl: clear invalidates cache", (t) => {
    let calls = 0;
    const fn = ttl((x) => { calls++; return x; }, { key: ([x]) => x, timeout: 5000 });
    fn(1);
    fn.clear();
    fn(1);
    if (calls === 2) {
        t.pass();
    } else {
        t.fail(`expected 2 calls after clear, got ${calls}`);
    }
});

test("ttl: gc removes expired entries", async (t) => {
    let calls = 0;
    const fn = ttl((x) => { calls++; return x; }, { key: ([x]) => x, timeout: 30 });
    fn(1); fn(2);
    await new Promise((r) => setTimeout(r, 60));
    fn.gc();
    fn(1); fn(2);
    if (calls === 4) {
        t.pass();
    } else {
        t.fail(`expected 4 calls after gc, got ${calls}`);
    }
});

test("ttl: setTimeout overrides timeout for a key", async (t) => {
    let calls = 0;
    const fn = ttl((x) => { calls++; return x; }, { key: ([x]) => x, timeout: 5000 });
    fn(1);
    fn.setTimeout(1, 30);
    await new Promise((r) => setTimeout(r, 60));
    fn(1);
    if (calls === 2) {
        t.pass();
    } else {
        t.fail(`expected 2 calls with custom timeout, got ${calls}`);
    }
});
