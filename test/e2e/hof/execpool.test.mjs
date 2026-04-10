import { test } from "worker-testbed";
import { execpool } from "../../../build/index.mjs";

test("throw: execpool → rejects propagate to caller", async (t) => {
    const fn = execpool(async () => { throw new Error("exec-throw"); }, { maxExec: 1, delay: 0 });
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "exec-throw") {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});

test("throw: execpool → queued task rejects propagate to caller", async (t) => {
    let first = true;
    const fn = execpool(async () => {
        if (first) {
            first = false;
            await new Promise((r) => setTimeout(r, 30));
            return 1;
        }
        throw new Error("exec-queued-throw");
    }, { maxExec: 1, delay: 0 });
    const p1 = fn();
    const p2 = fn();
    await p1;
    try {
        await p2;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "exec-queued-throw") {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});
