import { test } from "worker-testbed";
import { singlerun } from "../../../build/index.mjs";

test("singlerun: runs function and resolves", async (t) => {
    const fn = singlerun(async (x) => x * 2);
    const result = await fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${result}`);
    }
});

test("singlerun: concurrent calls share single run", async (t) => {
    let calls = 0;
    const fn = singlerun(async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 30));
        return calls;
    });
    const [r1, r2] = await Promise.all([fn(), fn()]);
    if (calls === 1 && r1 === 1 && r2 === 1) {
        t.pass();
    } else {
        t.fail(`calls=${calls} r1=${r1} r2=${r2}`);
    }
});

test("singlerun: runs again after clear", async (t) => {
    let calls = 0;
    const fn = singlerun(async () => { calls++; return calls; });
    await fn();
    fn.clear();
    await fn();
    if (calls === 2) {
        t.pass();
    } else {
        t.fail(`expected 2 calls, got ${calls}`);
    }
});

test("singlerun: getStatus returns ready/pending/fulfilled", async (t) => {
    const fn = singlerun(async () => {
        await new Promise((r) => setTimeout(r, 30));
    });
    if (fn.getStatus() !== "ready") { t.fail(`expected ready, got ${fn.getStatus()}`); return; }
    const p = fn();
    if (fn.getStatus() !== "pending") { t.fail(`expected pending, got ${fn.getStatus()}`); return; }
    await p;
    if (fn.getStatus() !== "fulfilled") { t.fail(`expected fulfilled, got ${fn.getStatus()}`); return; }
    t.pass();
});
