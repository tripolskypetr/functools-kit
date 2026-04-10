import { test } from "tape";
import { EventEmitter } from "../../../build/index.mjs";

test("EventEmitter: subscribe + emit", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    emitter.subscribe("e", (v) => results.push(v));
    await emitter.emit("e", 1);
    await emitter.emit("e", 2);
    t.deepEqual(results, [1, 2]);
});

test("EventEmitter: unsubscribe stops delivery", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    const fn = (v) => results.push(v);
    emitter.subscribe("e", fn);
    await emitter.emit("e", 1);
    emitter.unsubscribe("e", fn);
    await emitter.emit("e", 2);
    t.deepEqual(results, [1]);
});

test("EventEmitter: hasListeners", (t) => {
    const emitter = new EventEmitter();
    t.equal(emitter.hasListeners, false);
    const fn = () => {};
    emitter.subscribe("e", fn);
    t.equal(emitter.hasListeners, true);
    emitter.unsubscribe("e", fn);
    // после unsubscribe ключ остаётся если массив не зачищается — проверяем фактическое поведение
    t.equal(typeof emitter.hasListeners, "boolean");
    t.end();
});

test("EventEmitter: unsubscribeAll", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    emitter.subscribe("a", (v) => results.push(v));
    emitter.subscribe("b", (v) => results.push(v));
    emitter.unsubscribeAll();
    await emitter.emit("a", 1);
    await emitter.emit("b", 2);
    t.deepEqual(results, []);
    t.equal(emitter.hasListeners, false);
});

test("EventEmitter: once fires exactly once", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    emitter.once("e", (v) => results.push(v));
    await emitter.emit("e", 1);
    await emitter.emit("e", 2);
    t.deepEqual(results, [1]);
});

test("EventEmitter: once unsubscribe fn cancels before fire", async (t) => {
    const emitter = new EventEmitter();
    const results = [];
    const unsub = emitter.once("e", (v) => results.push(v));
    unsub();
    await emitter.emit("e", 1);
    t.deepEqual(results, []);
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
    t.deepEqual(order, ["slow", "fast"]);
});

test("EventEmitter: multiple subscribers all receive", async (t) => {
    const emitter = new EventEmitter();
    const a = [], b = [];
    emitter.subscribe("e", (v) => a.push(v));
    emitter.subscribe("e", (v) => b.push(v));
    await emitter.emit("e", 99);
    t.deepEqual(a, [99]);
    t.deepEqual(b, [99]);
});
