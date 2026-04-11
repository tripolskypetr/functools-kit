import { test } from "worker-testbed";
import {
    LimitedMap,
    LimitedSet,
    Lock,
    SortedArray,
    ToolRegistry,
} from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// LimitedMap
// ═══════════════════════════════════════════════════════════════════════════════

test("LimitedMap: basic set/get", (t) => {
    const m = new LimitedMap(5);
    m.set("a", 1);
    if (m.get("a") === 1) t.pass();
    else t.fail(`got ${m.get("a")}`);
});

test("LimitedMap: evicts oldest when full", (t) => {
    const m = new LimitedMap(3);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    m.set("d", 4); // "a" should be evicted
    if (!m.has("a") && m.has("d") && m.size === 3) t.pass();
    else t.fail(`has a=${m.has("a")} has d=${m.has("d")} size=${m.size}`);
});

test("LimitedMap: does not evict when under limit", (t) => {
    const m = new LimitedMap(5);
    m.set("a", 1);
    m.set("b", 2);
    if (m.size === 2 && m.has("a") && m.has("b")) t.pass();
    else t.fail(`size=${m.size}`);
});

test("LimitedMap: overwrite existing key does not grow size", (t) => {
    const m = new LimitedMap(3);
    m.set("a", 1);
    m.set("a", 99);
    if (m.size === 1 && m.get("a") === 99) t.pass();
    else t.fail(`size=${m.size} val=${m.get("a")}`);
});

test("LimitedMap: default max size is 20", (t) => {
    const m = new LimitedMap();
    for (let i = 0; i < 21; i++) m.set(i, i);
    if (m.size === 20 && !m.has(0)) t.pass();
    else t.fail(`size=${m.size} has0=${m.has(0)}`);
});

test("LimitedMap: extends Map — delete works", (t) => {
    const m = new LimitedMap(5);
    m.set("x", 10);
    m.delete("x");
    if (!m.has("x")) t.pass();
    else t.fail("expected key deleted");
});

// ═══════════════════════════════════════════════════════════════════════════════
// LimitedSet
// ═══════════════════════════════════════════════════════════════════════════════

test("LimitedSet: basic add/has", (t) => {
    const s = new LimitedSet(5);
    s.add("a");
    if (s.has("a")) t.pass();
    else t.fail("expected has a");
});

test("LimitedSet: evicts oldest when full", (t) => {
    const s = new LimitedSet(3);
    s.add("a");
    s.add("b");
    s.add("c");
    s.add("d"); // "a" should be evicted
    if (!s.has("a") && s.has("d") && s.size === 3) t.pass();
    else t.fail(`has a=${s.has("a")} has d=${s.has("d")} size=${s.size}`);
});

test("LimitedSet: does not evict when under limit", (t) => {
    const s = new LimitedSet(5);
    s.add("a");
    s.add("b");
    if (s.size === 2) t.pass();
    else t.fail(`size=${s.size}`);
});

test("LimitedSet: duplicate add doesn't grow size", (t) => {
    const s = new LimitedSet(5);
    s.add("a");
    s.add("a");
    if (s.size === 1) t.pass();
    else t.fail(`size=${s.size}`);
});

test("LimitedSet: default max size is 20", (t) => {
    const s = new LimitedSet();
    for (let i = 0; i < 21; i++) s.add(i);
    if (s.size === 20 && !s.has(0)) t.pass();
    else t.fail(`size=${s.size} has0=${s.has(0)}`);
});

test("LimitedSet: extends Set — delete works", (t) => {
    const s = new LimitedSet(5);
    s.add("x");
    s.delete("x");
    if (!s.has("x")) t.pass();
    else t.fail("expected deleted");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Lock
// ═══════════════════════════════════════════════════════════════════════════════

test("Lock: acquire and release", async (t) => {
    const lock = new Lock();
    await lock.acquireLock();
    await lock.releaseLock();
    t.pass();
});

test("Lock: serializes concurrent sections", async (t) => {
    const lock = new Lock();
    const order = [];
    const task = async (id) => {
        await lock.acquireLock();
        try {
            order.push(`start:${id}`);
            await new Promise(r => setTimeout(r, 10));
            order.push(`end:${id}`);
        } finally {
            await lock.releaseLock();
        }
    };
    await Promise.all([task(1), task(2)]);
    // sections must not interleave
    const valid = (
        order[0].startsWith("start:") &&
        order[1].startsWith("end:") &&
        order[2].startsWith("start:") &&
        order[3].startsWith("end:")
    );
    if (valid) t.pass();
    else t.fail(`order=${order}`);
});

test("Lock: extra release throws", async (t) => {
    const lock = new Lock();
    await lock.acquireLock();
    await lock.releaseLock();
    try {
        await lock.releaseLock();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message.includes("Extra release")) t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("Lock: re-acquirable after release", async (t) => {
    const lock = new Lock();
    await lock.acquireLock();
    await lock.releaseLock();
    await lock.acquireLock();
    await lock.releaseLock();
    t.pass();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SortedArray
// ═══════════════════════════════════════════════════════════════════════════════

test("SortedArray: push maintains descending score order", (t) => {
    const sa = new SortedArray();
    sa.push("low", 1);
    sa.push("high", 10);
    sa.push("mid", 5);
    const items = sa.getItems();
    if (items.join(",") === "high,mid,low") t.pass();
    else t.fail(`got ${items}`);
});

test("SortedArray: pop removes by reference", (t) => {
    const sa = new SortedArray();
    const obj = { id: 1 };
    sa.push(obj, 5);
    const removed = sa.pop(obj);
    if (removed === true && sa.length === 0) t.pass();
    else t.fail(`removed=${removed} length=${sa.length}`);
});

test("SortedArray: pop returns false for missing item", (t) => {
    const sa = new SortedArray();
    sa.push("a", 1);
    if (sa.pop("b") === false) t.pass();
    else t.fail("expected false");
});

test("SortedArray: take(n, minScore) returns top N items at or above minScore", (t) => {
    const sa = new SortedArray();
    sa.push("a", 3);
    sa.push("b", 1);
    sa.push("c", 2);
    // minScore=1 includes all three (scores 3,2,1 >= 1), take top 2
    const top2 = sa.take(2, 1);
    if (top2.join(",") === "a,c") t.pass();
    else t.fail(`got ${top2}`);
});

test("SortedArray: take minScore filters out low scores", (t) => {
    const sa = new SortedArray();
    sa.push("a", 10);
    sa.push("b", 5);
    sa.push("c", 1);
    // scores 10 and 5 are >= 5, score 1 is not
    const result = sa.take(10, 5);
    if (result.join(",") === "a,b") t.pass();
    else t.fail(`got ${result}`);
});

test("SortedArray: take default minScore=+Infinity yields nothing", (t) => {
    const sa = new SortedArray();
    sa.push("a", 100);
    // no score equals +Infinity, so take returns empty
    const result = sa.take(10);
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

test("SortedArray: getEntries includes scores", (t) => {
    const sa = new SortedArray();
    sa.push("x", 7);
    const entries = sa.getEntries();
    if (entries[0].item === "x" && entries[0].score === 7) t.pass();
    else t.fail(`got ${JSON.stringify(entries)}`);
});

test("SortedArray: length property", (t) => {
    const sa = new SortedArray();
    sa.push("a", 1);
    sa.push("b", 2);
    if (sa.length === 2) t.pass();
    else t.fail(`got ${sa.length}`);
});

test("SortedArray: iterable via for-of yields descending order", (t) => {
    const sa = new SortedArray();
    sa.push("a", 2);
    sa.push("b", 1);
    const result = [];
    for (const item of sa) result.push(item);
    if (result.join(",") === "a,b") t.pass();
    else t.fail(`got ${result}`);
});

test("SortedArray: equal scores — both present", (t) => {
    const sa = new SortedArray();
    sa.push("a", 5);
    sa.push("b", 5);
    if (sa.length === 2) t.pass();
    else t.fail(`got ${sa.length}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ToolRegistry
// ═══════════════════════════════════════════════════════════════════════════════

test("ToolRegistry: register and get", (t) => {
    const reg = new ToolRegistry("test");
    const reg2 = reg.register("myTool", { value: 42 });
    const tool = reg2.get("myTool");
    if (tool.value === 42) t.pass();
    else t.fail(`got ${JSON.stringify(tool)}`);
});

test("ToolRegistry: register same name twice throws", (t) => {
    const reg = new ToolRegistry("test").register("tool", {});
    try {
        reg.register("tool", {});
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message.includes("already registered")) t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("ToolRegistry: get unregistered throws", (t) => {
    const reg = new ToolRegistry("test");
    try {
        reg.get("missing");
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message.includes("not registered")) t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("ToolRegistry: override existing merges objects", (t) => {
    const reg = new ToolRegistry("test")
        .register("tool", { a: 1, b: 2 })
        .override("tool", { b: 99 });
    const tool = reg.get("tool");
    if (tool.a === 1 && tool.b === 99) t.pass();
    else t.fail(`got ${JSON.stringify(tool)}`);
});

test("ToolRegistry: override non-existing registers it", (t) => {
    const reg = new ToolRegistry("test").override("tool", { x: 7 });
    const tool = reg.get("tool");
    if (tool.x === 7) t.pass();
    else t.fail(`got ${JSON.stringify(tool)}`);
});

test("ToolRegistry: override with non-object replaces", (t) => {
    const reg = new ToolRegistry("test")
        .register("num", 1)
        .override("num", 99);
    if (reg.get("num") === 99) t.pass();
    else t.fail(`got ${reg.get("num")}`);
});

test("ToolRegistry: init calls init() on tools that have it", (t) => {
    let called = false;
    const reg = new ToolRegistry("test").register("tool", { init: () => { called = true; } });
    reg.init();
    if (called) t.pass();
    else t.fail("init() not called");
});

test("ToolRegistry: init skips tools without init()", (t) => {
    const reg = new ToolRegistry("test").register("tool", { value: 1 });
    reg.init(); // should not throw
    t.pass();
});

test("ToolRegistry: immutable — register returns new instance", (t) => {
    const reg1 = new ToolRegistry("test");
    const reg2 = reg1.register("a", 1);
    try {
        reg1.get("a");
        t.fail("reg1 should not have 'a'");
    } catch {
        if (reg2.get("a") === 1) t.pass();
        else t.fail("reg2 missing 'a'");
    }
});
