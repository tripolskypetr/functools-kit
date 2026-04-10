import { test } from "worker-testbed";
import { waitForNext, Subject, TIMEOUT_SYMBOL } from "../../../build/index.mjs";

test("waitForNext: resolves when condition met", async (t) => {
    const s = new Subject();
    const p = waitForNext(s, (v) => v === 42);
    s.next(1);
    s.next(42);
    const result = await p;
    if (result === 42) {
        t.pass();
    } else {
        t.fail(`expected 42, got ${String(result)}`);
    }
});

test("waitForNext: ignores values that don't match condition", async (t) => {
    const s = new Subject();
    const p = waitForNext(s, (v) => v > 10);
    s.next(1); s.next(5); s.next(15);
    const result = await p;
    if (result === 15) {
        t.pass();
    } else {
        t.fail(`expected 15, got ${String(result)}`);
    }
});

test("waitForNext: returns TIMEOUT_SYMBOL when delay exceeded", async (t) => {
    const s = new Subject();
    const p = waitForNext(s, () => false, 30);
    const result = await p;
    if (result === TIMEOUT_SYMBOL) {
        t.pass();
    } else {
        t.fail(`expected TIMEOUT_SYMBOL, got ${String(result)}`);
    }
});

test("waitForNext: does not timeout when delay=0 and resolves immediately", async (t) => {
    const s = new Subject();
    const p = waitForNext(s, (v) => v === 99, 0);
    s.next(99);
    const result = await p;
    if (result === 99) {
        t.pass();
    } else {
        t.fail(`expected 99, got ${String(result)}`);
    }
});
