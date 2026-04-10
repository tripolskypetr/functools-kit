import { test } from "worker-testbed";
import { cached } from "../../../build/index.mjs";

test("cached: calls run on first invocation", (t) => {
    let calls = 0;
    const fn = cached(
        (a, b) => a[0] !== b[0],
        (x) => { calls++; return x * 2; }
    );
    const result = fn(3);
    if (result === 6 && calls === 1) {
        t.pass();
    } else {
        t.fail(`result=${result} calls=${calls}`);
    }
});

test("cached: returns cached value when args unchanged", (t) => {
    let calls = 0;
    const fn = cached(
        (a, b) => a[0] !== b[0],
        (x) => { calls++; return x * 2; }
    );
    fn(3);
    const result = fn(3);
    if (result === 6 && calls === 1) {
        t.pass();
    } else {
        t.fail(`expected 1 call, got ${calls}`);
    }
});

test("cached: recalculates when args change", (t) => {
    let calls = 0;
    const fn = cached(
        (a, b) => a[0] !== b[0],
        (x) => { calls++; return x * 2; }
    );
    fn(3);
    const result = fn(5);
    if (result === 10 && calls === 2) {
        t.pass();
    } else {
        t.fail(`result=${result} calls=${calls}`);
    }
});

test("cached: clear resets cache", (t) => {
    let calls = 0;
    const fn = cached(
        (a, b) => !a || a[0] !== b[0],
        (x) => { calls++; return x * 2; }
    );
    fn(3);
    fn.clear();
    fn(3);
    if (calls === 2) {
        t.pass();
    } else {
        t.fail(`expected 2 calls after clear, got ${calls}`);
    }
});
