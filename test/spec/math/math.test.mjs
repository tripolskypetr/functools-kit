import { test } from "worker-testbed";
import {
    and,
    first,
    has,
    join,
    last,
    match,
    not,
    or,
    split,
    str,
    truely,
} from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// and
// ═══════════════════════════════════════════════════════════════════════════════

test("and: all true returns true", (t) => {
    if (and(true, true, true) === true) t.pass();
    else t.fail("expected true");
});

test("and: any false returns false", (t) => {
    if (and(true, false, true) === false) t.pass();
    else t.fail("expected false");
});

test("and: empty args returns true", (t) => {
    if (and() === true) t.pass();
    else t.fail("expected true");
});

test("and: numeric — all nonzero returns true", (t) => {
    if (and(1, 2, 3) === true) t.pass();
    else t.fail("expected true");
});

test("and: numeric — zero makes false", (t) => {
    if (and(1, 0, 3) === false) t.pass();
    else t.fail("expected false");
});

test("and: with promises — all truthy resolves true", async (t) => {
    const result = await and(Promise.resolve(true), Promise.resolve(1));
    if (result === true) t.pass();
    else t.fail(`got ${result}`);
});

test("and: with promises — any falsy resolves false", async (t) => {
    const result = await and(Promise.resolve(true), Promise.resolve(false));
    if (result === false) t.pass();
    else t.fail(`got ${result}`);
});

test("and: with promises — rejection propagates", async (t) => {
    try {
        await and(Promise.resolve(true), Promise.reject(new Error("and-err")));
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "and-err") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// or
// ═══════════════════════════════════════════════════════════════════════════════

test("or: any true returns true", (t) => {
    if (or(false, false, true) === true) t.pass();
    else t.fail("expected true");
});

test("or: all false returns false", (t) => {
    if (or(false, false, false) === false) t.pass();
    else t.fail("expected false");
});

test("or: empty args returns false", (t) => {
    if (or() === false) t.pass();
    else t.fail("expected false");
});

test("or: with promises — any truthy resolves true", async (t) => {
    const result = await or(Promise.resolve(false), Promise.resolve(1));
    if (result === true) t.pass();
    else t.fail(`got ${result}`);
});

test("or: with promises — all falsy resolves false", async (t) => {
    const result = await or(Promise.resolve(false), Promise.resolve(0));
    if (result === false) t.pass();
    else t.fail(`got ${result}`);
});

test("or: with promises — rejection propagates", async (t) => {
    try {
        await or(Promise.resolve(false), Promise.reject(new Error("or-err")));
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "or-err") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// not
// ═══════════════════════════════════════════════════════════════════════════════

test("not: true → false", (t) => {
    if (not(true) === false) t.pass();
    else t.fail("expected false");
});

test("not: false → true", (t) => {
    if (not(false) === true) t.pass();
    else t.fail("expected true");
});

test("not: 0 → true", (t) => {
    if (not(0) === true) t.pass();
    else t.fail("expected true");
});

test("not: 1 → false", (t) => {
    if (not(1) === false) t.pass();
    else t.fail("expected false");
});

test("not: promise true → false", async (t) => {
    const result = await not(Promise.resolve(true));
    if (result === false) t.pass();
    else t.fail(`got ${result}`);
});

test("not: promise false → true", async (t) => {
    const result = await not(Promise.resolve(false));
    if (result === true) t.pass();
    else t.fail(`got ${result}`);
});

test("not: promise rejection propagates", async (t) => {
    try {
        await not(Promise.reject(new Error("not-err")));
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "not-err") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// match
// ═══════════════════════════════════════════════════════════════════════════════

test("match: condition true returns run value", (t) => {
    const result = match({ condition: true, run: 42, not: 0 });
    if (result === 42) t.pass();
    else t.fail(`got ${result}`);
});

test("match: condition false returns not value", (t) => {
    const result = match({ condition: false, run: 42, not: 99 });
    if (result === 99) t.pass();
    else t.fail(`got ${result}`);
});

test("match: condition false defaults not to false", (t) => {
    const result = match({ condition: false, run: 42 });
    if (result === false) t.pass();
    else t.fail(`got ${result}`);
});

test("match: condition as function", (t) => {
    const result = match({ condition: () => true, run: "yes", not: "no" });
    if (result === "yes") t.pass();
    else t.fail(`got ${result}`);
});

test("match: run as function", (t) => {
    const result = match({ condition: true, run: () => "ran", not: "not-ran" });
    if (result === "ran") t.pass();
    else t.fail(`got ${result}`);
});

test("match: not as plain value", (t) => {
    const result = match({ condition: false, run: "yes", not: "fallback" });
    if (result === "fallback") t.pass();
    else t.fail(`got ${result}`);
});

test("match: async condition true", async (t) => {
    const result = await match({ condition: Promise.resolve(true), run: Promise.resolve("ok"), not: Promise.resolve("no") });
    if (result === "ok") t.pass();
    else t.fail(`got ${result}`);
});

test("match: async condition false", async (t) => {
    const result = await match({ condition: Promise.resolve(false), run: Promise.resolve("ok"), not: Promise.resolve("fallback") });
    if (result === "fallback") t.pass();
    else t.fail(`got ${result}`);
});

test("match: async rejection propagates", async (t) => {
    try {
        await match({ condition: Promise.reject(new Error("match-err")), run: "ok" });
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "match-err") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// first
// ═══════════════════════════════════════════════════════════════════════════════

test("first: returns first element", (t) => {
    if (first([10, 20, 30]) === 10) t.pass();
    else t.fail("expected 10");
});

test("first: single element array", (t) => {
    if (first([42]) === 42) t.pass();
    else t.fail("expected 42");
});

test("first: null array returns null", (t) => {
    if (first(null) === null) t.pass();
    else t.fail("expected null");
});

test("first: undefined array returns null", (t) => {
    if (first(undefined) === null) t.pass();
    else t.fail("expected null");
});

test("first: empty array returns null", (t) => {
    if (first([]) === null) t.pass();
    else t.fail("expected null");
});

// ═══════════════════════════════════════════════════════════════════════════════
// last
// ═══════════════════════════════════════════════════════════════════════════════

test("last: returns last element", (t) => {
    if (last([10, 20, 30]) === 30) t.pass();
    else t.fail("expected 30");
});

test("last: single element array", (t) => {
    if (last([42]) === 42) t.pass();
    else t.fail("expected 42");
});

test("last: null array returns null", (t) => {
    if (last(null) === null) t.pass();
    else t.fail("expected null");
});

test("last: undefined array returns null", (t) => {
    if (last(undefined) === null) t.pass();
    else t.fail("expected null");
});

test("last: empty array returns null", (t) => {
    if (last([]) === null) t.pass();
    else t.fail("expected null");
});

// ═══════════════════════════════════════════════════════════════════════════════
// has
// ═══════════════════════════════════════════════════════════════════════════════

test("has: array contains value", (t) => {
    if (has([1, 2, 3], 2) === true) t.pass();
    else t.fail("expected true");
});

test("has: array does not contain value", (t) => {
    if (has([1, 2, 3], 4) === false) t.pass();
    else t.fail("expected false");
});

test("has: array — any of multiple values", (t) => {
    if (has([1, 2, 3], 4, 2) === true) t.pass();
    else t.fail("expected true");
});

test("has: Set contains value", (t) => {
    if (has(new Set([1, 2, 3]), 2) === true) t.pass();
    else t.fail("expected true");
});

test("has: Set does not contain value", (t) => {
    if (has(new Set([1, 2, 3]), 4) === false) t.pass();
    else t.fail("expected false");
});

test("has: Map contains key", (t) => {
    if (has(new Map([["a", 1], ["b", 2]]), "a") === true) t.pass();
    else t.fail("expected true");
});

test("has: Map does not contain key", (t) => {
    if (has(new Map([["a", 1]]), "z") === false) t.pass();
    else t.fail("expected false");
});

test("has: scalar value matches", (t) => {
    if (has(42, 42) === true) t.pass();
    else t.fail("expected true");
});

test("has: scalar value no match", (t) => {
    if (has(42, 99) === false) t.pass();
    else t.fail("expected false");
});

test("has: null returns false", (t) => {
    if (has(null, 1) === false) t.pass();
    else t.fail("expected false");
});

// ═══════════════════════════════════════════════════════════════════════════════
// join
// ═══════════════════════════════════════════════════════════════════════════════

test("join: combines arrays, dedupes", (t) => {
    const result = join([1, 2], [2, 3]);
    if (result.join(",") === "1,2,3") t.pass();
    else t.fail(`got ${result}`);
});

test("join: filters null values", (t) => {
    const result = join([1, null, 2], null, [3]);
    if (result.join(",") === "1,2,3") t.pass();
    else t.fail(`got ${result}`);
});

test("join: nested arrays flattened", (t) => {
    const result = join([[1, 2], [3]]);
    if (result.join(",") === "1,2,3") t.pass();
    else t.fail(`got ${result}`);
});

test("join: single items", (t) => {
    const result = join("a", "b", "c");
    if (result.join(",") === "a,b,c") t.pass();
    else t.fail(`got ${result}`);
});

test("join: dedupes string items", (t) => {
    const result = join("a", "b", "a", "c");
    if (result.join(",") === "a,b,c") t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// split
// ═══════════════════════════════════════════════════════════════════════════════

test("split: splits by underscore", (t) => {
    const result = split("hello_world");
    if (result.join(",") === "hello,world") t.pass();
    else t.fail(`got ${result}`);
});

test("split: splits by dash", (t) => {
    const result = split("foo-bar");
    if (result.join(",") === "foo,bar") t.pass();
    else t.fail(`got ${result}`);
});

test("split: splits by space", (t) => {
    const result = split("one two");
    if (result.join(",") === "one,two") t.pass();
    else t.fail(`got ${result}`);
});

test("split: lowercases result", (t) => {
    const result = split("Hello_World");
    if (result.join(",") === "hello,world") t.pass();
    else t.fail(`got ${result}`);
});

test("split: multiple strings", (t) => {
    const result = split("a_b", "c-d");
    if (result.join(",") === "a,b,c,d") t.pass();
    else t.fail(`got ${result}`);
});

test("split: no separator — lowercases only", (t) => {
    const result = split("HELLO");
    if (result.join(",") === "hello") t.pass();
    else t.fail(`got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// str
// ═══════════════════════════════════════════════════════════════════════════════

test("str: joins with space", (t) => {
    const result = str("hello", "world");
    if (result === "hello world") t.pass();
    else t.fail(`got "${result}"`);
});

test("str: filters null", (t) => {
    const result = str("a", null, "b");
    if (result === "a b") t.pass();
    else t.fail(`got "${result}"`);
});

test("str: flattens arrays", (t) => {
    const result = str(["a", "b"], "c");
    if (result === "a b c") t.pass();
    else t.fail(`got "${result}"`);
});

test("str.newline: joins with newline", (t) => {
    const result = str.newline("a", "b", "c");
    if (result === "a\nb\nc") t.pass();
    else t.fail(`got "${result}"`);
});

test("str.comma: joins with comma-space", (t) => {
    const result = str.comma("x", "y", "z");
    if (result === "x, y, z") t.pass();
    else t.fail(`got "${result}"`);
});

test("str.dot: joins with dot-space", (t) => {
    const result = str.dot("one", "two");
    if (result === "one. two") t.pass();
    else t.fail(`got "${result}"`);
});

test("str.semicolon: joins with semicolon", (t) => {
    const result = str.semicolon("a", "b");
    if (result === "a;b") t.pass();
    else t.fail(`got "${result}"`);
});

test("str.table: formats as markdown table row", (t) => {
    const result = str.table("Name", "Age");
    if (result === "| Name | Age |") t.pass();
    else t.fail(`got "${result}"`);
});

test("str.space: same as default space", (t) => {
    const result = str.space("a", "b");
    if (result === "a b") t.pass();
    else t.fail(`got "${result}"`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// truely
// ═══════════════════════════════════════════════════════════════════════════════

test("truely: removes null values", (t) => {
    const result = truely(["a", null, "b", null, "c"]);
    if (result.join(",") === "a,b,c") t.pass();
    else t.fail(`got ${result}`);
});

test("truely: all non-null — unchanged", (t) => {
    const result = truely([1, 2, 3]);
    if (result.join(",") === "1,2,3") t.pass();
    else t.fail(`got ${result}`);
});

test("truely: all null — empty array", (t) => {
    const result = truely([null, null]);
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

test("truely: empty array — empty result", (t) => {
    const result = truely([]);
    if (result.length === 0) t.pass();
    else t.fail(`got ${result}`);
});

test("truely: mixed objects", (t) => {
    const a = { id: 1 };
    const b = { id: 2 };
    const result = truely([a, null, b]);
    if (result.length === 2 && result[0] === a && result[1] === b) t.pass();
    else t.fail(`got ${result}`);
});
