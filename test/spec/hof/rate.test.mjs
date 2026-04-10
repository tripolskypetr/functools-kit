import { test } from "worker-testbed";
import { rate, RateError } from "../../../build/index.mjs";

test("rate: first call returns value", (t) => {
    const fn = rate((x) => x * 2, { delay: 100 });
    const result = fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${result}`);
    }
});

test("rate: second call within delay throws RateError", (t) => {
    const fn = rate((x) => x, { delay: 500 });
    fn(1);
    try {
        fn(1);
        t.fail("should have thrown RateError");
    } catch (e) {
        if (e instanceof RateError) {
            t.pass();
        } else {
            t.fail(`expected RateError, got ${e}`);
        }
    }
});

test("rate: call after delay succeeds", async (t) => {
    const fn = rate((x) => x, { delay: 30 });
    fn(1);
    await new Promise((r) => setTimeout(r, 60));
    const result = fn(2);
    if (result === 2) {
        t.pass();
    } else {
        t.fail(`expected 2, got ${result}`);
    }
});

test("rate: clear removes cache allowing immediate retry", (t) => {
    const fn = rate((x) => x, { delay: 500 });
    fn(1);
    fn.clear();
    const result = fn(1);
    if (result === 1) {
        t.pass();
    } else {
        t.fail(`expected 1, got ${result}`);
    }
});
