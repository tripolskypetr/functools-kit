import { test } from "worker-testbed";
import { trycatch, CATCH_SYMBOL } from "../../../build/index.mjs";

test("trycatch: returns value when no error", (t) => {
    const fn = trycatch((x) => x * 2);
    const result = fn(5);
    if (result === 10) {
        t.pass();
    } else {
        t.fail(`expected 10, got ${result}`);
    }
});

test("trycatch: returns CATCH_SYMBOL on sync error", (t) => {
    const fn = trycatch(() => { throw new Error("boom"); });
    const result = fn();
    if (result === CATCH_SYMBOL) {
        t.pass();
    } else {
        t.fail(`expected CATCH_SYMBOL, got ${String(result)}`);
    }
});

test("trycatch: returns defaultValue on sync error", (t) => {
    const fn = trycatch(() => { throw new Error("boom"); }, { defaultValue: -1 });
    const result = fn();
    if (result === -1) {
        t.pass();
    } else {
        t.fail(`expected -1, got ${result}`);
    }
});

test("trycatch: calls fallback on sync error", (t) => {
    const errors = [];
    const fn = trycatch(() => { throw new Error("e"); }, {
        defaultValue: null,
        fallback: (err) => errors.push(err.message),
    });
    fn();
    if (errors.length === 1 && errors[0] === "e") {
        t.pass();
    } else {
        t.fail(`errors=${JSON.stringify(errors)}`);
    }
});

test("trycatch: handles async error, returns defaultValue", async (t) => {
    const fn = trycatch(async () => { throw new Error("async-boom"); }, { defaultValue: 99 });
    const result = await fn();
    if (result === 99) {
        t.pass();
    } else {
        t.fail(`expected 99, got ${result}`);
    }
});

test("trycatch: allowedErrors rethrows unmatched error", (t) => {
    class MyError extends Error {}
    class OtherError extends Error {}
    const fn = trycatch(() => { throw new OtherError("x"); }, {
        defaultValue: null,
        allowedErrors: [MyError],
    });
    try {
        fn();
        t.fail("should have rethrown");
    } catch (e) {
        if (e instanceof OtherError) {
            t.pass();
        } else {
            t.fail(`unexpected: ${e}`);
        }
    }
});
