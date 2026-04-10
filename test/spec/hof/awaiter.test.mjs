import { test } from "worker-testbed";
import { awaiter } from "../../../build/index.mjs";

test("awaiter: sync function returns value", (t) => {
    const fn = awaiter((x) => x * 2);
    const result = fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${result}`);
    }
});

test("awaiter: async function returns promise", async (t) => {
    const fn = awaiter(async (x) => x + 1);
    const result = await fn(4);
    if (result === 5) {
        t.pass();
    } else {
        t.fail(`expected 5, got ${result}`);
    }
});

test("awaiter: sync throw propagates", (t) => {
    const fn = awaiter(() => { throw new Error("boom"); });
    try {
        fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e.message === "boom") {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});

test("awaiter: async reject propagates", async (t) => {
    const fn = awaiter(async () => { throw new Error("async-boom"); });
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e.message === "async-boom") {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});
