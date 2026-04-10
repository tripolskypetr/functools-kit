import { test } from "worker-testbed";
import { singletick } from "../../../build/index.mjs";

test("singletick: returns value on first call", (t) => {
    let calls = 0;
    const fn = singletick(() => { calls++; return 42; });
    const result = fn();
    if (result === 42 && calls === 1) {
        t.pass();
    } else {
        t.fail(`result=${result} calls=${calls}`);
    }
});

test("singletick: subsequent synchronous calls return same cached result", (t) => {
    let calls = 0;
    const fn = singletick(() => { calls++; return calls; });
    fn(); fn(); fn();
    if (calls === 1) {
        t.pass();
    } else {
        t.fail(`expected 1 call, got ${calls}`);
    }
});

test("singletick: reruns after tick delay", async (t) => {
    let calls = 0;
    const fn = singletick(() => { calls++; return calls; });
    fn();
    await new Promise((r) => setTimeout(r, 10));
    fn();
    if (calls === 2) {
        t.pass();
    } else {
        t.fail(`expected 2 calls after delay, got ${calls}`);
    }
});
