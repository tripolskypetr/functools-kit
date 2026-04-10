import { test } from "worker-testbed";
import { execpool } from "../../../build/index.mjs";

test("execpool: executes and resolves", async (t) => {
    const fn = execpool(async (x) => x * 2, { maxExec: 2, delay: 0 });
    const result = await fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${result}`);
    }
});

test("execpool: concurrent results all resolve", async (t) => {
    const fn = execpool(async (x) => x + 1, { maxExec: 3, delay: 0 });
    const results = await Promise.all([fn(1), fn(2), fn(3)]);
    if (results[0] === 2 && results[1] === 3 && results[2] === 4) {
        t.pass();
    } else {
        t.fail(`expected [2,3,4], got ${JSON.stringify(results)}`);
    }
});

test("execpool: respects maxExec limit sequentially", async (t) => {
    const active = { max: 0, current: 0 };
    const fn = execpool(async () => {
        active.current++;
        active.max = Math.max(active.max, active.current);
        await new Promise((r) => setTimeout(r, 20));
        active.current--;
    }, { maxExec: 2, delay: 5 });
    await Promise.all([fn(), fn(), fn(), fn()]);
    if (active.max <= 2) {
        t.pass();
    } else {
        t.fail(`maxExec exceeded: max concurrent = ${active.max}`);
    }
});

test("execpool: rejects propagate", async (t) => {
    const fn = execpool(async () => { throw new Error("pool-err"); }, { maxExec: 1, delay: 0 });
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e.message === "pool-err") {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});
