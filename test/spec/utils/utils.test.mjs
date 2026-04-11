import { test } from "worker-testbed";
import {
    compareArray,
    compareFulltext,
    compose,
    create,
    createAwaiter,
    deepClone,
    deepCompare,
    deepFlat,
    deepMerge,
    errorData,
    formatText,
    get,
    getErrorMessage,
    isEmpty,
    isObject,
    isUndefined,
    randomString,
    set,
    sleep,
    typo,
} from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// compareArray
// ═══════════════════════════════════════════════════════════════════════════════

test("compareArray: equal arrays", (t) => {
    if (compareArray([1, 2, 3], [3, 2, 1]) === true) t.pass();
    else t.fail("expected true");
});

test("compareArray: different lengths", (t) => {
    if (compareArray([1, 2], [1, 2, 3]) === false) t.pass();
    else t.fail("expected false");
});

test("compareArray: different values", (t) => {
    if (compareArray([1, 2, 3], [1, 2, 4]) === false) t.pass();
    else t.fail("expected false");
});

test("compareArray: string arrays", (t) => {
    if (compareArray(["b", "a"], ["a", "b"]) === true) t.pass();
    else t.fail("expected true");
});

test("compareArray: boolean arrays", (t) => {
    if (compareArray([true, false], [false, true]) === true) t.pass();
    else t.fail("expected true");
});

test("compareArray: empty arrays", (t) => {
    if (compareArray([], []) === true) t.pass();
    else t.fail("expected true");
});

test("compareArray: non-array args return false", (t) => {
    if (compareArray(null, [1]) === false && compareArray([1], null) === false) t.pass();
    else t.fail("expected false");
});

// ═══════════════════════════════════════════════════════════════════════════════
// compareFulltext
// ═══════════════════════════════════════════════════════════════════════════════

test("compareFulltext: match in key", (t) => {
    if (compareFulltext({ name: "John Doe" }, "john", "name") === true) t.pass();
    else t.fail("expected true");
});

test("compareFulltext: no match", (t) => {
    if (compareFulltext({ name: "John Doe" }, "alice", "name") === false) t.pass();
    else t.fail("expected false");
});

test("compareFulltext: multi-word search — all words must match", (t) => {
    if (compareFulltext({ name: "John Doe" }, "john doe", "name") === true) t.pass();
    else t.fail("expected true");
});

test("compareFulltext: partial word match", (t) => {
    if (compareFulltext({ name: "Jonathan" }, "jon", "name") === true) t.pass();
    else t.fail("expected true");
});

test("compareFulltext: match across multiple keys", (t) => {
    const data = { first: "John", last: "Doe" };
    if (compareFulltext(data, "doe", "first", "last") === true) t.pass();
    else t.fail("expected true");
});

test("compareFulltext: empty search matches anything", (t) => {
    if (compareFulltext({ name: "hello" }, "", "name") === true) t.pass();
    else t.fail("expected true");
});

// ═══════════════════════════════════════════════════════════════════════════════
// compose
// ═══════════════════════════════════════════════════════════════════════════════

test("compose: two functions right-to-left", (t) => {
    const add1 = x => x + 1;
    const double = x => x * 2;
    const fn = compose(add1, double);
    if (fn(3) === 7) t.pass(); // double(3)=6, add1(6)=7
    else t.fail(`got ${fn(3)}`);
});

test("compose: three functions", (t) => {
    const fn = compose(x => x + 10, x => x * 2, x => x - 1);
    if (fn(5) === 18) t.pass(); // 5-1=4, *2=8, +10=18
    else t.fail(`got ${fn(5)}`);
});

test("compose: zero functions — identity", (t) => {
    const fn = compose();
    if (fn(42) === 42) t.pass();
    else t.fail(`got ${fn(42)}`);
});

test("compose: single function", (t) => {
    const fn = compose(x => x * 3);
    if (fn(4) === 12) t.pass();
    else t.fail(`got ${fn(4)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// create
// ═══════════════════════════════════════════════════════════════════════════════

test("create: creates nested path", (t) => {
    const obj = {};
    create(obj, "a.b");
    if (obj.a && typeof obj.a === "object") t.pass();
    else t.fail(`got ${JSON.stringify(obj)}`);
});

test("create: doesn't overwrite existing", (t) => {
    const obj = { a: { x: 1 } };
    create(obj, "a.b");
    if (obj.a.x === 1) t.pass();
    else t.fail(`obj.a.x lost: ${JSON.stringify(obj)}`);
});

test("create: array path", (t) => {
    const obj = {};
    create(obj, ["x", "y"]);
    if (obj.x && typeof obj.x === "object") t.pass();
    else t.fail(`got ${JSON.stringify(obj)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// createAwaiter
// ═══════════════════════════════════════════════════════════════════════════════

test("createAwaiter: resolves with value", async (t) => {
    const [promise, awaiter] = createAwaiter();
    awaiter.resolve(42);
    const result = await promise;
    if (result === 42) t.pass();
    else t.fail(`got ${result}`);
});

test("createAwaiter: rejects with error", async (t) => {
    const [promise, awaiter] = createAwaiter();
    awaiter.reject(new Error("awaiter-err"));
    try {
        await promise;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "awaiter-err") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("createAwaiter: resolve with promise", async (t) => {
    const [promise, awaiter] = createAwaiter();
    awaiter.resolve(Promise.resolve("chained"));
    const result = await promise;
    if (result === "chained") t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// deepClone
// ═══════════════════════════════════════════════════════════════════════════════

test("deepClone: creates independent copy", (t) => {
    const src = { a: 1, b: { c: 2 } };
    const clone = deepClone(src);
    clone.b.c = 99;
    if (src.b.c === 2 && clone.b.c === 99) t.pass();
    else t.fail(`src=${JSON.stringify(src)}`);
});

test("deepClone: copies primitive values", (t) => {
    const src = { x: 1, y: "hello", z: true };
    const clone = deepClone(src);
    if (clone.x === 1 && clone.y === "hello" && clone.z === true) t.pass();
    else t.fail(`got ${JSON.stringify(clone)}`);
});

test("deepClone: copies arrays shallowly", (t) => {
    const src = { arr: [1, 2, 3] };
    const clone = deepClone(src);
    clone.arr.push(4);
    if (src.arr.length === 3 && clone.arr.length === 4) t.pass();
    else t.fail(`src.arr=${src.arr}`);
});

test("deepClone: nested objects are independent", (t) => {
    const src = { a: { b: { c: 1 } } };
    const clone = deepClone(src);
    clone.a.b.c = 2;
    if (src.a.b.c === 1) t.pass();
    else t.fail(`src mutated: ${src.a.b.c}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// deepCompare
// ═══════════════════════════════════════════════════════════════════════════════

test("deepCompare: equal flat objects", (t) => {
    if (deepCompare({ a: 1, b: 2 }, { a: 1, b: 2 }) === true) t.pass();
    else t.fail("expected true");
});

test("deepCompare: different values", (t) => {
    if (deepCompare({ a: 1 }, { a: 2 }) === false) t.pass();
    else t.fail("expected false");
});

test("deepCompare: different key count", (t) => {
    if (deepCompare({ a: 1 }, { a: 1, b: 2 }) === false) t.pass();
    else t.fail("expected false");
});

test("deepCompare: nested equal objects", (t) => {
    if (deepCompare({ a: { b: 1 } }, { a: { b: 1 } }) === true) t.pass();
    else t.fail("expected true");
});

test("deepCompare: nested unequal objects", (t) => {
    if (deepCompare({ a: { b: 1 } }, { a: { b: 2 } }) === false) t.pass();
    else t.fail("expected false");
});

test("deepCompare: same reference", (t) => {
    const obj = { x: 1 };
    if (deepCompare(obj, obj) === true) t.pass();
    else t.fail("expected true");
});

// ═══════════════════════════════════════════════════════════════════════════════
// deepFlat
// ═══════════════════════════════════════════════════════════════════════════════

test("deepFlat: flattens child chain", (t) => {
    const tree = [{ id: 1, child: { id: 2, child: { id: 3 } } }];
    const result = deepFlat(tree);
    const ids = result.map(r => r.id).sort((a, b) => a - b).join(",");
    if (ids === "1,2,3") t.pass();
    else t.fail(`got ids=${ids}`);
});

test("deepFlat: flattens fields array", (t) => {
    const tree = [{ id: 1, fields: [{ id: 2 }, { id: 3 }] }];
    const result = deepFlat(tree);
    const ids = result.map(r => r.id).sort((a, b) => a - b).join(",");
    if (ids === "1,2,3") t.pass();
    else t.fail(`got ids=${ids}`);
});

test("deepFlat: flat list unchanged", (t) => {
    const list = [{ id: 1 }, { id: 2 }];
    const result = deepFlat(list);
    if (result.length === 2) t.pass();
    else t.fail(`got ${result.length}`);
});

test("deepFlat: empty array", (t) => {
    if (deepFlat([]).length === 0) t.pass();
    else t.fail("expected empty");
});

// ═══════════════════════════════════════════════════════════════════════════════
// deepMerge
// ═══════════════════════════════════════════════════════════════════════════════

test("deepMerge: merges flat objects", (t) => {
    const result = deepMerge({}, { a: 1 }, { b: 2 });
    if (result.a === 1 && result.b === 2) t.pass();
    else t.fail(`got ${JSON.stringify(result)}`);
});

test("deepMerge: nested merge", (t) => {
    const result = deepMerge({ a: { x: 1 } }, { a: { y: 2 } });
    if (result.a.x === 1 && result.a.y === 2) t.pass();
    else t.fail(`got ${JSON.stringify(result)}`);
});

test("deepMerge: later source overrides earlier", (t) => {
    const result = deepMerge({}, { a: 1 }, { a: 2 });
    if (result.a === 2) t.pass();
    else t.fail(`got ${result.a}`);
});

test("deepMerge: arrays are replaced not merged", (t) => {
    const result = deepMerge({ arr: [1, 2] }, { arr: [3] });
    if (result.arr.join(",") === "3") t.pass();
    else t.fail(`got ${result.arr}`);
});

test("deepMerge: no sources returns target", (t) => {
    const target = { a: 1 };
    const result = deepMerge(target);
    if (result === target) t.pass();
    else t.fail("expected same reference");
});

// ═══════════════════════════════════════════════════════════════════════════════
// errorData
// ═══════════════════════════════════════════════════════════════════════════════

test("errorData: extracts message and stack from Error", (t) => {
    const e = new Error("test-err");
    const result = errorData(e);
    if (result.message === "test-err" && typeof result.stack === "string") t.pass();
    else t.fail(`got ${JSON.stringify(result)}`);
});

test("errorData: null returns empty object", (t) => {
    const result = errorData(null);
    if (Object.keys(result).length === 0) t.pass();
    else t.fail(`got ${JSON.stringify(result)}`);
});

test("errorData: plain object — extracts own properties", (t) => {
    const result = errorData({ code: 42, msg: "hi" });
    if (result.code === 42 && result.msg === "hi") t.pass();
    else t.fail(`got ${JSON.stringify(result)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatText
// ═══════════════════════════════════════════════════════════════════════════════

test("formatText: formats phone-like template", (t) => {
    const result = formatText("9161234567", "+0 (000) 000-00-00");
    if (result === "+9 (161) 234-56-7") t.pass();
    else t.fail(`got "${result}"`);
});

test("formatText: no template returns raw", (t) => {
    const result = formatText("hello", "");
    if (result === "hello") t.pass();
    else t.fail(`got "${result}"`);
});

test("formatText: no raw returns raw (empty)", (t) => {
    const result = formatText("", "+0 (000)");
    if (result === "") t.pass();
    else t.fail(`got "${result}"`);
});

test("formatText: with allowed regex filter", (t) => {
    const result = formatText("a1b2c3", "000", { allowed: /[0-9]/ });
    if (result === "123") t.pass();
    else t.fail(`got "${result}"`);
});

test("formatText: with replace function", (t) => {
    const result = formatText("abc", "000", { replace: c => c.toUpperCase() });
    if (result === "ABC") t.pass();
    else t.fail(`got "${result}"`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// get
// ═══════════════════════════════════════════════════════════════════════════════

test("get: dot path", (t) => {
    const obj = { a: { b: { c: 42 } } };
    if (get(obj, "a.b.c") === 42) t.pass();
    else t.fail(`got ${get(obj, "a.b.c")}`);
});

test("get: array path", (t) => {
    const obj = { x: { y: "hello" } };
    if (get(obj, ["x", "y"]) === "hello") t.pass();
    else t.fail(`got ${get(obj, ["x", "y"])}`);
});

test("get: missing path returns undefined", (t) => {
    const obj = { a: 1 };
    if (get(obj, "a.b.c") === undefined) t.pass();
    else t.fail(`got ${get(obj, "a.b.c")}`);
});

test("get: top-level key", (t) => {
    const obj = { name: "test" };
    if (get(obj, "name") === "test") t.pass();
    else t.fail(`got ${get(obj, "name")}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// getErrorMessage
// ═══════════════════════════════════════════════════════════════════════════════

test("getErrorMessage: Error object", (t) => {
    if (getErrorMessage(new Error("boom")) === "boom") t.pass();
    else t.fail(`got ${getErrorMessage(new Error("boom"))}`);
});

test("getErrorMessage: string", (t) => {
    if (getErrorMessage("raw error") === "raw error") t.pass();
    else t.fail("expected string passthrough");
});

test("getErrorMessage: object with message", (t) => {
    if (getErrorMessage({ message: "msg-err" }) === "msg-err") t.pass();
    else t.fail(`got ${getErrorMessage({ message: "msg-err" })}`);
});

test("getErrorMessage: object with error.message", (t) => {
    if (getErrorMessage({ error: { message: "nested-err" } }) === "nested-err") t.pass();
    else t.fail(`got ${getErrorMessage({ error: { message: "nested-err" } })}`);
});

test("getErrorMessage: object with data.message", (t) => {
    if (getErrorMessage({ data: { message: "data-err" } }) === "data-err") t.pass();
    else t.fail(`got ${getErrorMessage({ data: { message: "data-err" } })}`);
});

test("getErrorMessage: null returns Unknown error", (t) => {
    if (getErrorMessage(null) === "Unknown error") t.pass();
    else t.fail(`got ${getErrorMessage(null)}`);
});

test("getErrorMessage: undefined returns Unknown error", (t) => {
    if (getErrorMessage(undefined) === "Unknown error") t.pass();
    else t.fail(`got ${getErrorMessage(undefined)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// isEmpty
// ═══════════════════════════════════════════════════════════════════════════════

test("isEmpty: empty object", (t) => {
    if (isEmpty({}) === true) t.pass();
    else t.fail("expected true");
});

test("isEmpty: non-empty object", (t) => {
    if (isEmpty({ a: 1 }) === false) t.pass();
    else t.fail("expected false");
});

test("isEmpty: object with symbol key", (t) => {
    const sym = Symbol("k");
    const obj = {};
    obj[sym] = 1;
    if (isEmpty(obj) === false) t.pass();
    else t.fail("expected false for symbol-keyed object");
});

// ═══════════════════════════════════════════════════════════════════════════════
// isObject
// ═══════════════════════════════════════════════════════════════════════════════

test("isObject: plain object", (t) => {
    if (isObject({}) === true) t.pass();
    else t.fail("expected true");
});

test("isObject: class instance is false", (t) => {
    if (isObject(new Date()) === false) t.pass();
    else t.fail("expected false for Date");
});

test("isObject: array is false", (t) => {
    if (isObject([]) === false) t.pass();
    else t.fail("expected false for array");
});

test("isObject: null is false", (t) => {
    if (isObject(null) === false) t.pass();
    else t.fail("expected false for null");
});

test("isObject: primitive is false", (t) => {
    if (isObject(42) === false) t.pass();
    else t.fail("expected false for number");
});

// ═══════════════════════════════════════════════════════════════════════════════
// isUndefined
// ═══════════════════════════════════════════════════════════════════════════════

test("isUndefined: undefined", (t) => {
    if (isUndefined(undefined) === true) t.pass();
    else t.fail("expected true");
});

test("isUndefined: null is false", (t) => {
    if (isUndefined(null) === false) t.pass();
    else t.fail("expected false");
});

test("isUndefined: 0 is false", (t) => {
    if (isUndefined(0) === false) t.pass();
    else t.fail("expected false");
});

test("isUndefined: empty string is false", (t) => {
    if (isUndefined("") === false) t.pass();
    else t.fail("expected false");
});

// ═══════════════════════════════════════════════════════════════════════════════
// randomString
// ═══════════════════════════════════════════════════════════════════════════════

test("randomString: returns non-empty string", (t) => {
    const s = randomString();
    if (typeof s === "string" && s.length > 0) t.pass();
    else t.fail(`got ${s}`);
});

test("randomString: two calls produce different values", (t) => {
    const a = randomString();
    const b = randomString();
    if (a !== b) t.pass();
    else t.fail("expected unique values");
});

test("randomString: has UUID-like format with dashes", (t) => {
    const s = randomString();
    if (s.includes("-")) t.pass();
    else t.fail(`got ${s}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// set
// ═══════════════════════════════════════════════════════════════════════════════

test("set: sets nested value", (t) => {
    const obj = { a: { b: 1 } };
    const ok = set(obj, "a.b", 99);
    if (ok === true && obj.a.b === 99) t.pass();
    else t.fail(`ok=${ok} obj=${JSON.stringify(obj)}`);
});

test("set: sets top-level key", (t) => {
    const obj = { x: 0 };
    set(obj, "x", 42);
    if (obj.x === 42) t.pass();
    else t.fail(`got ${obj.x}`);
});

test("set: array path", (t) => {
    const obj = { a: { b: 0 } };
    set(obj, ["a", "b"], 7);
    if (obj.a.b === 7) t.pass();
    else t.fail(`got ${obj.a.b}`);
});

test("set: returns false on invalid path", (t) => {
    const ok = set({}, "a.b.c", 1);
    if (ok === false) t.pass();
    else t.fail(`expected false, got ${ok}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// sleep
// ═══════════════════════════════════════════════════════════════════════════════

test("sleep: resolves after delay", async (t) => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    if (elapsed >= 40) t.pass();
    else t.fail(`elapsed only ${elapsed}ms`);
});

test("sleep: resolves with void", async (t) => {
    const result = await sleep(0);
    if (result === undefined) t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// typo
// ═══════════════════════════════════════════════════════════════════════════════

test("typo: thinsp is thin space character", (t) => {
    if (typo.thinsp === '\u2009') t.pass();
    else t.fail(`got ${JSON.stringify(typo.thinsp)}`);
});

test("typo: nbsp is non-breaking space", (t) => {
    if (typo.nbsp === '\u00a0') t.pass();
    else t.fail(`got ${JSON.stringify(typo.nbsp)}`);
});

test("typo: emdash is em dash", (t) => {
    if (typo.emdash === '—') t.pass();
    else t.fail(`got ${typo.emdash}`);
});

test("typo: endash is en dash", (t) => {
    if (typo.endash === '–') t.pass();
    else t.fail(`got ${typo.endash}`);
});

test("typo: bullet is bullet character", (t) => {
    if (typo.bullet === '\u2022') t.pass();
    else t.fail(`got ${JSON.stringify(typo.bullet)}`);
});

test("typo: terminator is null char", (t) => {
    if (typo.terminator === '\x00') t.pass();
    else t.fail(`got ${JSON.stringify(typo.terminator)}`);
});
