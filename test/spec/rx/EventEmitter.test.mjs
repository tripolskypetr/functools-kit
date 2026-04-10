import { test } from "worker-testbed";
import { EventEmitter } from "../../../build/index.mjs";

test("EventEmitter: subscribe + emit", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    emitter.subscribe("e", (v) => results.push(v));
    await emitter.emit("e", 1);
    await emitter.emit("e", 2);
    if (results[0] === 1 && results[1] === 2 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [1,2], got ${JSON.stringify(results)}`);
    }
});

test("EventEmitter: unsubscribe stops delivery", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    const fn = (v) => results.push(v);
    emitter.subscribe("e", fn);
    await emitter.emit("e", 1);
    emitter.unsubscribe("e", fn);
    await emitter.emit("e", 2);
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("EventEmitter: hasListeners", (t) => {
    const emitter = new EventEmitter();
    if (emitter.hasListeners !== false) { t.fail("should be false initially"); return; }
    const fn = () => {};
    emitter.subscribe("e", fn);
    if (emitter.hasListeners !== true) { t.fail("should be true after subscribe"); return; }
    t.pass();
});

test("EventEmitter: unsubscribeAll", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    emitter.subscribe("a", (v) => results.push(v));
    emitter.subscribe("b", (v) => results.push(v));
    emitter.unsubscribeAll();
    await emitter.emit("a", 1);
    await emitter.emit("b", 2);
    if (results.length === 0 && emitter.hasListeners === false) {
        t.pass();
    } else {
        t.fail(`expected [] and no listeners, got ${JSON.stringify(results)}, hasListeners=${emitter.hasListeners}`);
    }
});

test("EventEmitter: once fires exactly once", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    emitter.once("e", (v) => results.push(v));
    await emitter.emit("e", 1);
    await emitter.emit("e", 2);
    if (results.length === 1 && results[0] === 1) {
        t.pass();
    } else {
        t.fail(`expected [1], got ${JSON.stringify(results)}`);
    }
});

test("EventEmitter: once unsubscribe fn cancels before fire", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    const unsub = emitter.once("e", (v) => results.push(v));
    unsub();
    await emitter.emit("e", 1);
    if (results.length === 0) {
        t.pass();
    } else {
        t.fail(`expected [], got ${JSON.stringify(results)}`);
    }
});

test("EventEmitter: emit is sequential", async (t) => {
    const emitter = new EventEmitter();
    const order = [];
    emitter.subscribe("e", async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push("slow");
    });
    emitter.subscribe("e", () => order.push("fast"));
    await emitter.emit("e");
    if (order[0] === "slow" && order[1] === "fast") {
        t.pass();
    } else {
        t.fail(`expected ["slow","fast"], got ${JSON.stringify(order)}`);
    }
});

test("EventEmitter: multiple subscribers all receive", async (t) => {
    const emitter = new EventEmitter();
    const a = [], b = [];
    emitter.subscribe("e", (v) => a.push(v));
    emitter.subscribe("e", (v) => b.push(v));
    await emitter.emit("e", 99);
    if (a[0] === 99 && b[0] === 99) {
        t.pass();
    } else {
        t.fail(`a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
    }
});
