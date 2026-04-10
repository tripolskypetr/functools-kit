import { test } from "worker-testbed";
import { pubsub } from "../../../build/index.mjs";

test("throw: pubsub → emitter throws, treated as failure, retries", async (t) => {
    let calls = 0;
    const fn = pubsub(async () => {
        calls++;
        if (calls < 2) throw new Error("transient");
        return true;
    }, { timeout: 5000 });
    await fn("x");
    if (calls >= 2) {
        t.pass();
    } else {
        t.fail(`expected retry after throw, calls=${calls}`);
    }
});

test("throw: pubsub → onError called with data and error when emitter throws", async (t) => {
    const errors = [];
    let calls = 0;
    const fn = pubsub(async (data) => {
        calls++;
        if (calls < 2) throw new Error("onerror-test");
        return true;
    }, {
        timeout: 5000,
        onError: async (data, e) => { errors.push({ data, message: e.message }); },
    });
    await fn("payload");
    if (errors.length === 1 && errors[0].data === "payload" && errors[0].message === "onerror-test") {
        t.pass();
    } else {
        t.fail(`unexpected errors: ${JSON.stringify(errors)}`);
    }
});
