import { test } from "worker-testbed";
import { pubsub } from "../../../build/index.mjs";

test("pubsub: emitter receives committed data", async (t) => {
    const received = [];
    const fn = pubsub(async (data) => {
        received.push(data);
        return true;
    });
    await fn(1);
    await fn(2);
    if (received[0] === 1 && received[1] === 2 && received.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [1,2], got ${JSON.stringify(received)}`);
    }
});

test("pubsub: retries on emitter returning false then true", async (t) => {
    let calls = 0;
    const fn = pubsub(async (data) => {
        calls++;
        return calls >= 2;
    }, { timeout: 5000 });
    await fn("x");
    if (calls >= 2) {
        t.pass();
    } else {
        t.fail(`expected >= 2 calls, got ${calls}`);
    }
});

test("pubsub: stop halts processing", async (t) => {
    const received = [];
    const fn = pubsub(async (data) => {
        received.push(data);
        return true;
    });
    await fn(1);
    await fn.stop();
    if (received.length === 1 && received[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(received)}`);
    }
});

test("pubsub: onBegin and onEnd hooks called", async (t) => {
    const events = [];
    const fn = pubsub(async () => true, {
        onBegin: async () => { events.push("begin"); },
        onEnd: async () => { events.push("end"); },
    });
    await fn("x");
    if (events[0] === "begin" && events[1] === "end") {
        t.pass();
    } else {
        t.fail(`events=${JSON.stringify(events)}`);
    }
});
