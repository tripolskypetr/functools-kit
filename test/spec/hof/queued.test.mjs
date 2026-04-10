import { test } from "worker-testbed";
import { queued, CANCELED_PROMISE_SYMBOL } from "../../../build/index.mjs";

test("queued: resolves in order", async (t) => {
    const order = [];
    const fn = queued(async (x) => { order.push(x); return x; });
    await Promise.all([fn(1), fn(2), fn(3)]);
    if (JSON.stringify(order) === JSON.stringify([1, 2, 3])) {
        t.pass();
    } else {
        t.fail(`expected [1,2,3], got ${JSON.stringify(order)}`);
    }
});

test("queued: cancel returns CANCELED_PROMISE_SYMBOL for pending", async (t) => {
    let started = false;
    const fn = queued(async (x) => {
        started = true;
        await new Promise((r) => setTimeout(r, 50));
        return x;
    });
    const p1 = fn(1);
    const p2 = fn(2);
    fn.cancel();
    const [r1, r2] = await Promise.all([p1, p2]);
    if (r2 === CANCELED_PROMISE_SYMBOL) {
        t.pass();
    } else {
        t.fail(`expected r2=CANCELED, got r2=${String(r2)}`);
    }
});

test("queued: clear resets queue", async (t) => {
    const fn = queued(async (x) => x);
    await fn(1);
    fn.clear();
    const result = await fn(2);
    if (result === 2) {
        t.pass();
    } else {
        t.fail(`expected 2, got ${result}`);
    }
});

test("queued: rejects propagate", async (t) => {
    const fn = queued(async () => { throw new Error("q-err"); });
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e.message === "q-err") {
            t.pass();
        } else {
            t.fail(`unexpected: ${e}`);
        }
    }
});
