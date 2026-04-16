import { test } from "worker-testbed";
import { singleshot } from "../../../build/index.mjs";

test("singleshot: runs on first call", (t) => {
    let calls = 0;
    const fn = singleshot(() => { calls++; return 42; });
    const result = fn();
    if (result === 42 && calls === 1) {
        t.pass();
    } else {
        t.fail(`result=${result} calls=${calls}`);
    }
});

test("singleshot: returns cached result on subsequent calls", (t) => {
    let calls = 0;
    const fn = singleshot(() => { calls++; return calls; });
    fn(); fn(); fn();
    if (calls === 1) {
        t.pass();
    } else {
        t.fail(`expected 1 call, got ${calls}`);
    }
});

test("singleshot: clear allows re-run", (t) => {
    let calls = 0;
    const fn = singleshot(() => { calls++; return calls; });
    fn();
    fn.clear();
    const result = fn();
    if (calls === 2 && result === 2) {
        t.pass();
    } else {
        t.fail(`calls=${calls} result=${result}`);
    }
});

test("singleshot: rejected promise resets hasRunned and allows retry", async (t) => {
    let calls = 0;
    const fn = singleshot(async () => { calls++; if (calls === 1) throw new Error("fail"); return 42; });
    try { await fn(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 0));
    let result;
    try { result = await fn(); } catch (_) {}
    if (result === 42 && calls === 2) {
        t.pass();
    } else {
        t.fail(`calls=${calls} result=${result}`);
    }
});

test("singleshot: hasValue reflects state", (t) => {
    const fn = singleshot(() => 1);
    if (fn.hasValue() !== false) { t.fail("should be false before run"); return; }
    fn();
    if (fn.hasValue() !== true) { t.fail("should be true after run"); return; }
    fn.clear();
    if (fn.hasValue() !== false) { t.fail("should be false after clear"); return; }
    t.pass();
});
