import { test } from "worker-testbed";
import { afterinit } from "../../../build/index.mjs";

test("afterinit: first call is skipped", async (t) => {
    const results = [];
    const fn = afterinit(async (v) => { results.push(v); });
    await fn(1);
    if (results.length === 0) {
        t.pass();
    } else {
        t.fail(`expected [], got ${JSON.stringify(results)}`);
    }
});

test("afterinit: second call executes", async (t) => {
    const results = [];
    const fn = afterinit(async (v) => { results.push(v); });
    await fn(1);
    await fn(2);
    if (results.length === 1 && results[0] === 2) {
        t.pass();
    } else {
        t.fail(`expected [2], got ${JSON.stringify(results)}`);
    }
});

test("afterinit: clear resets state", async (t) => {
    const results = [];
    const fn = afterinit(async (v) => { results.push(v); });
    await fn(1);
    fn.clear();
    await fn(2);
    if (results.length === 0) {
        t.pass();
    } else {
        t.fail(`expected [] after clear+first call, got ${JSON.stringify(results)}`);
    }
});

test("afterinit: multiple calls after first all execute", async (t) => {
    const results = [];
    const fn = afterinit(async (v) => { results.push(v); });
    await fn(0);
    await fn(1);
    await fn(2);
    await fn(3);
    if (JSON.stringify(results) === JSON.stringify([1, 2, 3])) {
        t.pass();
    } else {
        t.fail(`expected [1,2,3], got ${JSON.stringify(results)}`);
    }
});
