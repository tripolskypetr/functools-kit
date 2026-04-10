import { test } from "worker-testbed";
import { lock } from "../../../build/index.mjs";

test("lock: executes normally without lock", async (t) => {
    const fn = lock(async (x) => x * 2);
    const result = await fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${result}`);
    }
});

test("lock: blocks execution during lock", async (t) => {
    const fn = lock(async (x) => x + 1);
    fn.beginLock();
    let resolved = false;
    const p = fn(1).then((v) => { resolved = true; return v; });
    await new Promise((r) => setTimeout(r, 50));
    if (resolved) {
        t.fail("should be blocked during lock");
        return;
    }
    await fn.endLock();
    const result = await p;
    if (result === 2 && resolved) {
        t.pass();
    } else {
        t.fail(`result=${result} resolved=${resolved}`);
    }
});

test("lock: multiple beginLock/endLock pairs work", async (t) => {
    const fn = lock(async (x) => x + 10);
    fn.beginLock();
    fn.endLock();
    const result = await fn(5);
    if (result === 15) {
        t.pass();
    } else {
        t.fail(`expected 15, got ${result}`);
    }
});

test("lock: clear resets lock state", async (t) => {
    const fn = lock(async () => 99);
    fn.beginLock();
    fn.clear();
    const result = await fn();
    if (result === 99) {
        t.pass();
    } else {
        t.fail(`expected 99 after clear, got ${result}`);
    }
});
