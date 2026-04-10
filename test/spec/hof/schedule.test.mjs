import { test } from "worker-testbed";
import { schedule } from "../../../build/index.mjs";

test("schedule: runs immediately when not pending", async (t) => {
    const results = [];
    const fn = schedule(
        async (x) => { results.push(x); return x; },
        { onSchedule: async () => {}, delay: 50 }
    );
    await fn(1);
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("schedule: returns result for sequential calls", async (t) => {
    const results = [];
    const fn = schedule(
        async (x) => { results.push(x); return x; },
        { onSchedule: async () => {}, delay: 10 }
    );
    await fn(1);
    await fn(2);
    if (results[0] === 1 && results[1] === 2) {
        t.pass();
    } else {
        t.fail(`expected [1,2], got ${JSON.stringify(results)}`);
    }
});

test("schedule: clear resets scheduled args", async (t) => {
    const results = [];
    const fn = schedule(
        async (x) => { results.push(x); return x; },
        { onSchedule: async () => {}, delay: 10 }
    );
    fn.clear();
    await fn(42);
    if (results[0] === 42) {
        t.pass();
    } else {
        t.fail(`expected [42], got ${JSON.stringify(results)}`);
    }
});
