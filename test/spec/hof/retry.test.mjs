import { test } from "worker-testbed";
import { retry } from "../../../build/index.mjs";

test("retry: succeeds on first try", async (t) => {
    const fn = retry(async (x) => x * 2, 3, 0);
    const result = await fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${result}`);
    }
});

test("retry: retries and succeeds before exhaustion", async (t) => {
    let attempts = 0;
    const fn = retry(async () => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return 42;
    }, 5, 0);
    const result = await fn();
    if (result === 42 && attempts === 3) {
        t.pass();
    } else {
        t.fail(`attempts=${attempts} result=${result}`);
    }
});

test("retry: throws after exhausting count", async (t) => {
    let attempts = 0;
    const fn = retry(async () => {
        attempts++;
        throw new Error("always-fail");
    }, 3, 0);
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e.message === "always-fail" && attempts === 3) {
            t.pass();
        } else {
            t.fail(`attempts=${attempts} error=${e}`);
        }
    }
});

test("retry: condition skips retry when false", async (t) => {
    let attempts = 0;
    const fn = retry(async () => {
        attempts++;
        throw new Error("skip");
    }, 5, 0, () => false);
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (attempts === 1) {
            t.pass();
        } else {
            t.fail(`expected 1 attempt, got ${attempts}`);
        }
    }
});
