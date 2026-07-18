import { test } from "worker-testbed";
import {
    has,
    and,
    or,
    not,
    match,
    str,
    split,
} from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// has (src/utils/math/has.ts)
// The scalar branch guarded with `if (arr)`, so a falsy scalar (0, "", false)
// could never match its own value — has(0, 0) returned false.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: has: falsy scalars match themselves", (t) => {
    if (has(0, 0) && has("", "") && has(false, false)) t.pass();
    else t.fail(`has(0,0)=${has(0, 0)}, has("","")=${has("", "")}, has(false,false)=${has(false, false)}`);
});

test("regression: has: null/undefined containers still return false", (t) => {
    if (has(null, null) === false && has(undefined, undefined) === false) t.pass();
    else t.fail("null/undefined container matched");
});

// ═══════════════════════════════════════════════════════════════════════════════
// and / or / not / match (src/utils/math/)
// Thenables (promise-like objects without Promise in their prototype chain)
// failed the `instanceof Promise` gate and took the sync path, where the
// thenable OBJECT (always truthy) was used instead of its resolved value.
// ═══════════════════════════════════════════════════════════════════════════════

const thenable = (value) => ({ then(resolve) { resolve(value); } });

test("regression: and: thenable resolving false is awaited, not treated as truthy object", async (t) => {
    const result = await and(thenable(false), true);
    if (result === false) t.pass();
    else t.fail(`expected false, got ${result}`);
});

test("regression: or: single thenable resolving false yields false", async (t) => {
    const result = await or(thenable(false));
    if (result === false) t.pass();
    else t.fail(`expected false, got ${result}`);
});

test("regression: not: thenable is awaited before negation", async (t) => {
    const negFalse = await not(thenable(false));
    const negTrue = await not(thenable(true));
    if (negFalse === true && negTrue === false) t.pass();
    else t.fail(`not(thenable(false))=${negFalse}, not(thenable(true))=${negTrue}`);
});

test("regression: match: thenable condition resolving false takes the not branch", async (t) => {
    const result = await match({ condition: thenable(false), run: "RUN", not: "NOT" });
    if (result === "NOT") t.pass();
    else t.fail(`expected NOT, got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// str (src/utils/math/str.ts)
// The internal filter `typeof v === "string" || !!v` silently dropped the
// number 0 even though every str variant accepts number in its signature —
// str.table even lost a whole cell, corrupting the row shape.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: str: number 0 is kept", (t) => {
    if (str("count:", 0) === "count: 0" && str.comma("a", 0) === "a, 0") t.pass();
    else t.fail(`str("count:",0)="${str("count:", 0)}", str.comma("a",0)="${str.comma("a", 0)}"`);
});

test("regression: str.table: 0 cell does not disappear from the row", (t) => {
    if (str.table("id", 0) === "| id | 0 |") t.pass();
    else t.fail(`got "${str.table("id", 0)}"`);
});

test("regression: str: null values still filtered out", (t) => {
    if (str("a", null, "b") === "a b") t.pass();
    else t.fail(`got "${str("a", null, "b")}"`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// split (src/utils/math/split.ts)
// Adjacent/leading/trailing separators produced empty-string fragments, and
// dedupe ran on raw inputs before lowercasing/splitting so case variants and
// reordered compound tokens survived as duplicates.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: split: no empty fragments from adjacent separators", (t) => {
    const a = split("a_-b");
    const b = split("_");
    if (a.join(",") === "a,b" && b.length === 0) t.pass();
    else t.fail(`split("a_-b")=[${a}], split("_")=[${b}]`);
});

test("regression: split: deduplicates after lowercasing and splitting", (t) => {
    const caseVariants = split("Foo", "foo");
    const compound = split("a-b", "b-a");
    if (caseVariants.join(",") === "foo" && compound.join(",") === "a,b") t.pass();
    else t.fail(`split("Foo","foo")=[${caseVariants}], split("a-b","b-a")=[${compound}]`);
});
