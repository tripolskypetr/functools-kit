import { test } from "worker-testbed";
import { debounce } from "../../../build/index.mjs";

test("debounce: fires after delay", async (t) => {
    const results = [];
    const fn = debounce((v) => results.push(v), 40);
    fn(1);
    await new Promise((r) => setTimeout(r, 100));
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("debounce: only last call fires", async (t) => {
    const results = [];
    const fn = debounce((v) => results.push(v), 40);
    fn(1); fn(2); fn(3);
    await new Promise((r) => setTimeout(r, 100));
    if (results.length === 1 && results[0] === 3) {
        t.pass();
    } else {
        t.fail(`expected [3], got ${JSON.stringify(results)}`);
    }
});

test("debounce: clear prevents execution", async (t) => {
    const results = [];
    const fn = debounce((v) => results.push(v), 40);
    fn(1);
    fn.clear();
    await new Promise((r) => setTimeout(r, 100));
    if (results.length === 0) {
        t.pass();
    } else {
        t.fail(`expected [], got ${JSON.stringify(results)}`);
    }
});

test("debounce: flush executes immediately", (t) => {
    const results = [];
    const fn = debounce((v) => results.push(v), 200);
    fn(42);
    fn.flush();
    if (results.length === 1 && results[0] === 42) {
        t.pass();
    } else {
        t.fail(`expected [42], got ${JSON.stringify(results)}`);
    }
});

test("debounce: pending returns true when scheduled", (t) => {
    const fn = debounce(() => {}, 200);
    fn(1);
    const p = fn.pending();
    fn.clear();
    if (p === true) {
        t.pass();
    } else {
        t.fail(`expected true, got ${p}`);
    }
});

test("debounce: pending returns false after fire", async (t) => {
    const fn = debounce(() => {}, 40);
    fn(1);
    await new Promise((r) => setTimeout(r, 100));
    if (fn.pending() === false) {
        t.pass();
    } else {
        t.fail("expected false after debounce fired");
    }
});
