import { test } from "worker-testbed";
import { cancelable, CANCELED_PROMISE_SYMBOL } from "../../../build/index.mjs";

test("cancelable: resolves normally without cancel", async (t) => {
    const fn = cancelable(async (x) => x * 2);
    const result = await fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${String(result)}`);
    }
});

test("cancelable: cancel before resolve returns CANCELED_PROMISE_SYMBOL", async (t) => {
    const fn = cancelable(() => new Promise((r) => setTimeout(() => r(42), 50)));
    const p = fn();
    fn.cancel();
    const result = await p;
    if (result === CANCELED_PROMISE_SYMBOL) {
        t.pass();
    } else {
        t.fail(`expected CANCELED_PROMISE_SYMBOL, got ${String(result)}`);
    }
});

test("cancelable: second call cancels first", async (t) => {
    const results = [];
    const fn = cancelable((id) => new Promise((r) => setTimeout(() => r(id), 50)));
    const p1 = fn(1);
    const p2 = fn(2);
    const [r1, r2] = await Promise.all([p1, p2]);
    results.push(r1, r2);
    if (r1 === CANCELED_PROMISE_SYMBOL && r2 === 2) {
        t.pass();
    } else {
        t.fail(`r1=${String(r1)} r2=${String(r2)}`);
    }
});

test("cancelable: rejects propagate when not canceled", async (t) => {
    const fn = cancelable(async () => { throw new Error("err"); });
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e.message === "err") {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});
