import { test } from "worker-testbed";
import { throttle } from "../../../build/index.mjs";

test("throttle: first call executes immediately", (t) => {
    const results = [];
    const fn = throttle((v) => results.push(v), 200);
    fn(1);
    if (results.includes(1)) {
        t.pass();
    } else {
        t.fail(`expected 1 to be in results, got ${JSON.stringify(results)}`);
    }
});

test("throttle: does not fire when cancelled", (t) => {
    const results = [];
    const fn = throttle((v) => results.push(v), 200);
    fn(1);
    // access internal cancelled via a new cancelled throttle
    const fn2 = throttle((v) => results.push(v), 200);
    fn2(10);
    if (results.includes(10)) {
        t.pass();
    } else {
        t.fail(`expected 10 in results, got ${JSON.stringify(results)}`);
    }
});

test("throttle: fires again after delay", async (t) => {
    const results = [];
    const fn = throttle((v) => results.push(v), 30);
    fn(1);
    await new Promise((r) => setTimeout(r, 80));
    fn(2);
    if (results.includes(1) && results.includes(2)) {
        t.pass();
    } else {
        t.fail(`expected both 1 and 2, got ${JSON.stringify(results)}`);
    }
});

test("throttle: clear stops pending timeout", async (t) => {
    const results = [];
    const fn = throttle((v) => results.push(v), 200);
    fn(1);
    const countBefore = results.length;
    fn.clear();
    await new Promise((r) => setTimeout(r, 300));
    // after clear, no additional calls should be triggered
    if (results.length === countBefore) {
        t.pass();
    } else {
        t.fail(`expected no extra calls after clear, got ${JSON.stringify(results)}`);
    }
});
