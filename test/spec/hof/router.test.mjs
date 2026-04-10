import { test } from "worker-testbed";
import { router } from "../../../build/index.mjs";

test("router: first call for a key executes", (t) => {
    let calls = 0;
    const fn = router(
        ([id]) => id,
        ([, a], [, b]) => a !== b,
        (id, val) => { calls++; return val * 2; }
    );
    const result = fn(1, 5);
    if (result === 10 && calls === 1) {
        t.pass();
    } else {
        t.fail(`result=${result} calls=${calls}`);
    }
});

test("router: same args returns cached value", (t) => {
    let calls = 0;
    const fn = router(
        ([id]) => id,
        ([, a], [, b]) => a !== b,
        (id, val) => { calls++; return val * 2; }
    );
    fn(1, 5);
    const result = fn(1, 5);
    if (result === 10 && calls === 1) {
        t.pass();
    } else {
        t.fail(`expected cache hit, calls=${calls}`);
    }
});

test("router: changed args re-executes for same key", (t) => {
    let calls = 0;
    const fn = router(
        ([id]) => id,
        ([, a], [, b]) => a !== b,
        (id, val) => { calls++; return val * 2; }
    );
    fn(1, 5);
    const result = fn(1, 7);
    if (result === 14 && calls === 2) {
        t.pass();
    } else {
        t.fail(`result=${result} calls=${calls}`);
    }
});

test("router: different keys are independent", (t) => {
    let calls = 0;
    const fn = router(
        ([id]) => id,
        ([, a], [, b]) => a !== b,
        (id, val) => { calls++; return val + id; }
    );
    const a = fn(1, 10);
    const b = fn(2, 20);
    if (a === 11 && b === 22 && calls === 2) {
        t.pass();
    } else {
        t.fail(`a=${a} b=${b} calls=${calls}`);
    }
});

test("router: clear by key removes that key only", (t) => {
    let calls = 0;
    const fn = router(
        ([id]) => id,
        ([, a], [, b]) => a !== b,
        (id, val) => { calls++; return val; }
    );
    fn(1, 10); fn(2, 20);
    fn.clear(1);
    fn(1, 10); fn(2, 20);
    if (calls === 3) {
        t.pass();
    } else {
        t.fail(`expected 3 calls, got ${calls}`);
    }
});

test("router: clear all resets all keys", (t) => {
    let calls = 0;
    const fn = router(
        ([id]) => id,
        ([, a], [, b]) => a !== b,
        (id, val) => { calls++; return val; }
    );
    fn(1, 10); fn(2, 20);
    fn.clear();
    fn(1, 10); fn(2, 20);
    if (calls === 4) {
        t.pass();
    } else {
        t.fail(`expected 4 calls, got ${calls}`);
    }
});
