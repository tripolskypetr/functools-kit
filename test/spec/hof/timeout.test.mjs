import { test } from "worker-testbed";
import { timeout, TIMEOUT_SYMBOL } from "../../../build/index.mjs";

test("timeout: resolves before timeout", async (t) => {
    const fn = timeout(async () => 42, 200);
    const result = await fn();
    if (result === 42) {
        t.pass();
    } else {
        t.fail(`expected 42, got ${String(result)}`);
    }
});

test("timeout: returns TIMEOUT_SYMBOL when exceeded", async (t) => {
    const fn = timeout(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return 1;
    }, 30);
    const result = await fn();
    if (result === TIMEOUT_SYMBOL) {
        t.pass();
    } else {
        t.fail(`expected TIMEOUT_SYMBOL, got ${String(result)}`);
    }
});

test("timeout: passes args to wrapped fn", async (t) => {
    const fn = timeout(async (x, y) => x + y, 200);
    const result = await fn(3, 4);
    if (result === 7) {
        t.pass();
    } else {
        t.fail(`expected 7, got ${result}`);
    }
});
