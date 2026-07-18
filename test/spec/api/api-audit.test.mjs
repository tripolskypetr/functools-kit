import { test } from "worker-testbed";
import {
    iterateDocuments,
    iterateUnion,
    pickDocuments,
    paginateDocuments,
    distinctDocuments,
    SortedArray,
    LimitedMap,
    LimitedSet,
    deepCompare,
    sleep,
} from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// iterateDocuments (src/api/iterateDocuments.ts)
// The prefetched next page was a bare promise: if the consumer stopped
// iterating (break) while it was in flight, its rejection became an unhandled
// rejection and crashed the process. Also, the next page was prefetched
// unconditionally, firing one orphan request past the totalDocuments boundary.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: iterateDocuments: prefetch rejection after consumer break is not unhandled", async (t) => {
    const iterator = iterateDocuments({
        totalDocuments: 100,
        limit: 2,
        delay: 1,
        createRequest: ({ page }) => {
            if (page === 0) return [{ id: 1 }, { id: 2 }];
            return Promise.reject(new Error("page2 failed"));
        },
    });
    for await (const _ of iterator) {
        break; // abandon while page 2 prefetch is in flight
    }
    await sleep(50);
    // worker-testbed rethrows unhandled rejections: reaching this line means
    // the floating prefetch rejection was guarded
    t.pass();
});

test("regression: iterateDocuments: prefetched page rejection still surfaces to the consumer", async (t) => {
    const iterator = iterateDocuments({
        totalDocuments: 100,
        limit: 2,
        delay: 1,
        createRequest: ({ page }) => {
            if (page === 0) return [{ id: 1 }, { id: 2 }];
            return Promise.reject(new Error("page2 failed"));
        },
    });
    const chunks = [];
    let error = null;
    try {
        for await (const chunk of iterator) {
            chunks.push(chunk);
        }
    } catch (e) {
        error = e;
    }
    if (chunks.length === 1 && error && error.message === "page2 failed") t.pass();
    else t.fail(`chunks=${chunks.length}, error=${error && error.message}`);
});

test("regression: iterateDocuments: no orphan request past totalDocuments boundary", async (t) => {
    const pages = [];
    const iterator = iterateDocuments({
        totalDocuments: 4,
        limit: 2,
        delay: 1,
        createRequest: ({ page }) => {
            pages.push(page);
            return [{ id: page * 2 + 1 }, { id: page * 2 + 2 }];
        },
    });
    for await (const _ of iterator) { /* drain */ }
    await sleep(50);
    if (pages.length === 2) t.pass();
    else t.fail(`expected 2 requests for totalDocuments=4 limit=2, got pages [${pages}]`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// iterateUnion (src/api/iterateUnion.ts)
// On limit exhaustion, consumer break, or a source error the generator exited
// without calling .return() on the source iterators, leaking whatever
// resources (cursors, connections) the remaining sources held.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: iterateUnion: closes started source on limit exhaustion", async (t) => {
    const closed = [];
    const makeSource = (name, items) => (async function* () {
        try {
            for (const item of items) yield item;
        } finally {
            closed.push(name);
        }
    })();
    const a = makeSource("a", [{ id: 1 }, { id: 2 }, { id: 3 }]);
    const b = makeSource("b", [{ id: 4 }]);
    const union = iterateUnion([a, b]);
    const rows = [];
    for await (const row of union(2, 0)) rows.push(row.id);
    if (rows.join(",") === "1,2" && closed.includes("a")) t.pass();
    else t.fail(`rows=[${rows}], closed=[${closed}]`);
});

test("regression: iterateUnion: marks unstarted sources done on limit exhaustion", async (t) => {
    const makeSource = (items) => (async function* () {
        for (const item of items) yield item;
    })();
    const a = makeSource([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const b = makeSource([{ id: 4 }]);
    const union = iterateUnion([a, b]);
    for await (const _ of union(2, 0)) { /* drain */ }
    const next = await b.next();
    if (next.done === true) t.pass();
    else t.fail(`expected source b to be done, got ${JSON.stringify(next)}`);
});

test("regression: iterateUnion: closes remaining sources when a source throws", async (t) => {
    const bad = (async function* () {
        yield { id: 1 };
        throw new Error("boom");
    })();
    const good = (async function* () { yield { id: 2 }; })();
    const union = iterateUnion([bad, good]);
    let threw = false;
    try {
        for await (const _ of union(10, 0)) { /* drain */ }
    } catch (e) {
        threw = e.message === "boom";
    }
    const next = await good.next();
    if (threw && next.done === true) t.pass();
    else t.fail(`threw=${threw}, good.next()=${JSON.stringify(next)}`);
});

test("regression: iterateUnion: closes sources on early consumer break", async (t) => {
    const closed = [];
    const makeSource = (name, items) => (async function* () {
        try {
            for (const item of items) yield item;
        } finally {
            closed.push(name);
        }
    })();
    const a = makeSource("a", [{ id: 1 }, { id: 2 }]);
    const b = makeSource("b", [{ id: 3 }]);
    const union = iterateUnion([a, b]);
    for await (const _ of union(10, 0)) {
        break;
    }
    const next = await b.next();
    if (closed.includes("a") && next.done === true) t.pass();
    else t.fail(`closed=[${closed}], b.next()=${JSON.stringify(next)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// pickDocuments (src/api/pickDocuments.ts)
// The picker returned its live internal accumulator: earlier results silently
// grew on later calls, and pushing into a returned rows array corrupted the
// picker state.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: pickDocuments: returned rows are a copy, not the live accumulator", (t) => {
    const iter = pickDocuments(10, 0);
    const first = iter([1, 2]);
    iter([3, 4]);
    if (first.rows.join(",") === "1,2") t.pass();
    else t.fail(`earlier result mutated by later call: [${first.rows}]`);
});

test("regression: pickDocuments: mutating returned rows does not corrupt picker state", (t) => {
    const iter = pickDocuments(10, 0);
    iter([1]).rows.push("INJECTED");
    const rows = iter([2]).rows;
    if (rows.join(",") === "1,2") t.pass();
    else t.fail(`picker state corrupted: [${rows}]`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// paginateDocuments (src/api/paginateDocuments.ts)
// With limit <= 0 the page is complete before consuming anything, but one
// chunk (a potentially expensive fetch) was still pulled from the source.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: paginateDocuments: limit=0 pulls zero chunks from the source", async (t) => {
    let pulls = 0;
    const source = (async function* () {
        pulls += 1;
        yield [1, 2];
        pulls += 1;
        yield [3, 4];
    })();
    const rows = await paginateDocuments(source, 0, 0);
    if (rows.length === 0 && pulls === 0) t.pass();
    else t.fail(`rows=[${rows}], pulls=${pulls}`);
});

test("regression: paginateDocuments: still fills a normal page correctly", async (t) => {
    const source = (async function* () {
        yield [1, 2, 3];
        yield [4, 5, 6];
        yield [7, 8, 9];
    })();
    const rows = await paginateDocuments(source, 3, 2);
    if (rows.join(",") === "3,4,5") t.pass();
    else t.fail(`expected [3,4,5], got [${rows}]`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// distinctDocuments (src/api/distinctDocuments.ts)
// Rows without an id all mapped to the single Set key `undefined`, so every
// row after the first was silently dropped as a "duplicate".
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: distinctDocuments: id-less rows pass through instead of collapsing", async (t) => {
    const source = (async function* () {
        yield [{ name: "a" }, { name: "b" }, { name: "c" }];
    })();
    const out = [];
    for await (const row of distinctDocuments(source)) out.push(row.name);
    if (out.join(",") === "a,b,c") t.pass();
    else t.fail(`expected all rows, got [${out}]`);
});

test("regression: distinctDocuments: real ids still deduplicate (including falsy 0 and '')", async (t) => {
    const source = (async function* () {
        yield [{ id: 0 }, { id: "" }, { id: 1 }];
        yield [{ id: 0 }, { id: 1 }, { id: 2 }];
    })();
    const out = [];
    for await (const row of distinctDocuments(source)) out.push(row.id);
    if (out.join(",") === "0,,1,2") t.pass();
    else t.fail(`expected [0,,1,2], got [${out}]`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SortedArray (src/helpers/SortedArray.ts)
// Equal-score items were inserted before earlier ones (unstable order), and
// getEntries() returned live internal entry objects that the caller could
// mutate, corrupting the sort invariant.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: SortedArray: equal-score push keeps insertion order (stable)", (t) => {
    const arr = new SortedArray();
    arr.push("first", 1);
    arr.push("second", 1);
    arr.push("third", 1);
    const items = arr.getItems();
    if (items.join(",") === "first,second,third") t.pass();
    else t.fail(`expected stable order, got [${items}]`);
});

test("regression: SortedArray: getEntries returns copies, not live internals", (t) => {
    const arr = new SortedArray();
    arr.push("a", 5);
    arr.push("b", 3);
    const entries = arr.getEntries();
    entries[0].score = -100;
    entries[0].item = "hacked";
    const items = arr.getItems();
    if (items.join(",") === "a,b") t.pass();
    else t.fail(`internal state mutated through getEntries: [${items}]`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// LimitedMap / LimitedSet (src/helpers/LimitedMap.ts, LimitedSet.ts)
// maxSize <= 0 evicted only one entry and then stored anyway, keeping one
// item in a container that should hold nothing; a shrunken maxSize was never
// enforced below the current size (single evict instead of a loop).
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: LimitedMap: maxSize=0 holds nothing", (t) => {
    const map = new LimitedMap(0);
    map.set("a", 1);
    map.set("b", 2);
    if (map.size === 0) t.pass();
    else t.fail(`expected empty map, size=${map.size}`);
});

test("regression: LimitedMap: eviction keeps FIFO order without refresh", (t) => {
    const map = new LimitedMap(2);
    map.set("a", 1);
    map.set("b", 2);
    map.set("a", 10); // update must not refresh recency
    map.set("c", 3);  // evicts oldest ("a")
    const keys = [...map.keys()].join(",");
    if (keys === "b,c" && map.get("b") === 2 && map.get("c") === 3) t.pass();
    else t.fail(`keys=[${keys}]`);
});

test("regression: LimitedSet: maxSize=0 holds nothing", (t) => {
    const set = new LimitedSet(0);
    set.add("a");
    set.add("b");
    if (set.size === 0) t.pass();
    else t.fail(`expected empty set, size=${set.size}`);
});

test("regression: LimitedSet: evicts oldest when full", (t) => {
    const set = new LimitedSet(2);
    set.add("a");
    set.add("b");
    set.add("c");
    const values = [...set.values()].join(",");
    if (values === "b,c") t.pass();
    else t.fail(`values=[${values}]`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// deepCompare (src/utils/deepCompare.ts)
// Same key count with different key names compared equal when the extra keys
// held undefined: {a:1, b:undefined} was "equal" to {a:1, c:5} because
// obj2[prop] lookups for missing keys returned undefined.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: deepCompare: differing key names are not equal", (t) => {
    if (deepCompare({ a: 1, b: undefined }, { a: 1, c: 5 }) === false) t.pass();
    else t.fail("objects with different keys compared equal");
});

test("regression: deepCompare: identical nested plain objects still compare equal", (t) => {
    if (deepCompare({ a: 1, b: { c: 2, d: 3 } }, { a: 1, b: { c: 2, d: 3 } }) === true) t.pass();
    else t.fail("identical objects compared unequal");
});
