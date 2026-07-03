import { test } from "worker-testbed";
import {
    throttle,
    queued,
    rate,
    iterateUnion,
    iterateDocuments,
    LimitedMap,
    LimitedSet,
    BehaviorSubject,
    Source,
    PubsubArrayAdapter,
    match,
    deepMerge,
    fetchApi,
    trycatch,
    first,
    last,
    sleep,
} from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// throttle (src/utils/hof/throttle.ts)
// timeoutID is never assigned, so `if (!timeoutID) exec()` fires on every call
// and the trailing `if (elapsed > delay) exec()` double-fires the first call.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: throttle: single call executes run exactly once", (t) => {
    let calls = 0;
    const fn = throttle(() => calls++, 100);
    fn();
    if (calls === 1) t.pass();
    else t.fail(`expected 1 execution, got ${calls}`);
});

test("regression: throttle: rapid calls within delay are suppressed", (t) => {
    let calls = 0;
    const fn = throttle(() => calls++, 100);
    fn(); fn(); fn(); fn(); fn();
    if (calls === 1) t.pass();
    else t.fail(`expected 1 execution for 5 rapid calls, got ${calls}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// LimitedMap / LimitedSet (src/helpers/LimitedMap.ts, LimitedSet.ts)
// The eviction check runs before looking whether the key already exists,
// so updating an existing key at capacity evicts an unrelated oldest entry.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: LimitedMap: updating existing key at capacity must not evict others", (t) => {
    const m = new LimitedMap(2);
    m.set("a", 1);
    m.set("b", 2);
    m.set("b", 3); // size does not grow, nothing should be evicted
    if (m.has("a") && m.get("b") === 3 && m.size === 2) t.pass();
    else t.fail(`has(a)=${m.has("a")} b=${m.get("b")} size=${m.size}`);
});

test("regression: LimitedSet: re-adding existing value at capacity must not evict others", (t) => {
    const s = new LimitedSet(2);
    s.add("a");
    s.add("b");
    s.add("b"); // already present, nothing should be evicted
    if (s.has("a") && s.has("b") && s.size === 2) t.pass();
    else t.fail(`has(a)=${s.has("a")} has(b)=${s.has("b")} size=${s.size}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// queued (src/utils/hof/queued.ts)
// The .finally() of each queued segment resets lastPromise to Promise.resolve()
// as soon as that segment settles, dropping the still-pending tail of the chain.
// A call made right after the first one settles runs concurrently with the second.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: queued: stays serialized after a previous call settles", async (t) => {
    let active = 0;
    let maxActive = 0;
    const fn = queued(async (id) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await sleep(50);
        active -= 1;
        return id;
    });
    const p1 = fn(1);
    const p2 = fn(2);
    await p1;          // first call settled — internal chain gets reset here
    const p3 = fn(3);  // must wait for #2 to finish
    await Promise.all([p2, p3]);
    if (maxActive === 1) t.pass();
    else t.fail(`expected serialized execution, got ${maxActive} concurrent runs`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BehaviorSubject (src/utils/rx/BehaviorSubject.ts)
// toObserver replays the current value via `this._data && observer.emit(...)`,
// so falsy values (0, "", false) are silently not replayed to late subscribers.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: BehaviorSubject: replays falsy current value 0 on connect", async (t) => {
    const bs = new BehaviorSubject();
    await bs.next(0);
    const got = [];
    bs.toObserver().connect((v) => got.push(v));
    await sleep(10);
    if (got.length === 1 && got[0] === 0) t.pass();
    else t.fail(`expected [0], got ${JSON.stringify(got)}`);
});

test("regression: BehaviorSubject: replays falsy current value false on connect", async (t) => {
    const bs = new BehaviorSubject(false);
    const got = [];
    bs.toObserver().connect((v) => got.push(v));
    await sleep(10);
    if (got.length === 1 && got[0] === false) t.pass();
    else t.fail(`expected [false], got ${JSON.stringify(got)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// rate.gc (src/utils/hof/rate.ts)
// gc reads item.current.ttl but entries are stored as { value, tick, when },
// so the age check is always NaN and expired entries are never collected.
// remove(key) returning true after gc proves the entry survived collection.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: rate.gc: collects expired entries", async (t) => {
    const fn = rate((x) => x * 2, { key: ([x]) => String(x), delay: 20 });
    fn(5);
    await sleep(60); // entry is now older than delay
    fn.gc();
    const removed = fn.remove("5");
    if (removed === false) t.pass();
    else t.fail(`entry survived gc: remove() returned ${removed}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// iterateUnion (src/api/iterateUnion.ts)
// Rows consumed by the offset are not added to duplicateSet, so the same id
// can be yielded again from another iterator — pages overlap on duplicates.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: iterateUnion: rows skipped by offset still deduplicate", async (t) => {
    async function* gen(rows) {
        for (const row of rows) yield row;
    }
    const out = [];
    const iterate = iterateUnion([gen([{ id: 1 }]), gen([{ id: 1 }, { id: 2 }])]);
    for await (const row of iterate(10, 1)) {
        out.push(row.id);
    }
    // distinct union is [1, 2]; offset=1 skips id=1, leaving [2]
    if (JSON.stringify(out) === "[2]") t.pass();
    else t.fail(`expected [2], got ${JSON.stringify(out)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// match (src/utils/math/match.ts)
// `not` passed as a function was returned uncalled instead of being invoked,
// and `run` was executed eagerly even when the condition was false.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: match: invokes `not` function on false condition", (t) => {
    const result = match({ condition: false, run: () => 1, not: () => 2 });
    if (result === 2) t.pass();
    else t.fail(`expected 2, got ${typeof result === "function" ? "uncalled function" : result}`);
});

test("regression: match: does not execute run when condition is false", (t) => {
    let sideEffect = 0;
    match({ condition: false, run: () => { sideEffect += 1; return 1; }, not: 0 });
    if (sideEffect === 0) t.pass();
    else t.fail(`run executed ${sideEffect} times on false condition`);
});

test("regression: match: async condition invokes function branches", async (t) => {
    const result = await match({
        condition: Promise.resolve(false),
        run: () => "run",
        not: () => "fallback",
    });
    if (result === "fallback") t.pass();
    else t.fail(`expected "fallback", got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// deepMerge (src/utils/deepMerge.ts)
// A source object could not overwrite a truthy primitive in the target:
// the recursion into a primitive was a no-op and the source subtree was lost.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: deepMerge: source object overrides target primitive", (t) => {
    const result = deepMerge({ a: 1 }, { a: { b: 2 } });
    if (JSON.stringify(result) === '{"a":{"b":2}}') t.pass();
    else t.fail(`expected {"a":{"b":2}}, got ${JSON.stringify(result)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// fetchApi (src/api/fetchApi.ts)
// Spreading init.headers dropped everything when a Headers instance (or an
// array of pairs) was passed, because Headers has no enumerable own props.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: fetchApi: keeps headers passed as Headers instance", async (t) => {
    const realFetch = globalThis.fetch;
    let captured;
    globalThis.fetch = async (_url, options) => {
        captured = options;
        return { ok: true, json: async () => ({}) };
    };
    try {
        await fetchApi("http://localhost/test", {
            headers: new Headers({ Authorization: "Bearer token-1" }),
        });
    } finally {
        globalThis.fetch = realFetch;
    }
    const merged = new Headers(captured.headers);
    if (merged.get("authorization") === "Bearer token-1") t.pass();
    else t.fail(`authorization header lost: ${merged.get("authorization")}`);
});

test("regression: fetchApi: default Content-Type still applied for POST", async (t) => {
    const realFetch = globalThis.fetch;
    let captured;
    globalThis.fetch = async (_url, options) => {
        captured = options;
        return { ok: true, json: async () => ({}) };
    };
    try {
        await fetchApi("http://localhost/test", { method: "POST", body: "{}" });
    } finally {
        globalThis.fetch = realFetch;
    }
    const merged = new Headers(captured.headers);
    if (merged.get("content-type") === "application/json") t.pass();
    else t.fail(`content-type=${merged.get("content-type")}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// trycatch (src/utils/hof/trycatch.ts)
// allowedErrors was checked only in the sync path; an async function throwing
// a non-allowed error was silently swallowed into defaultValue.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: trycatch: allowedErrors rethrows unmatched async error", async (t) => {
    class AllowedError extends Error {}
    const fn = trycatch(
        async () => { throw new TypeError("not-allowed"); },
        { allowedErrors: [AllowedError], defaultValue: null },
    );
    try {
        await fn();
        t.fail("unmatched async error was swallowed");
    } catch (e) {
        if (e instanceof TypeError) t.pass();
        else t.fail(`unexpected error: ${e}`);
    }
});

test("regression: trycatch: allowedErrors returns default for matched async error", async (t) => {
    class AllowedError extends Error {}
    const fn = trycatch(
        async () => { throw new AllowedError("allowed"); },
        { allowedErrors: [AllowedError], defaultValue: "default" },
    );
    const result = await fn();
    if (result === "default") t.pass();
    else t.fail(`expected "default", got ${result}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// first / last (src/utils/math/first.ts, last.ts)
// `value || null` turned falsy elements (0, false, "") into null,
// contradicting the documented "null only for null/empty array" contract.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: first: returns falsy first element", (t) => {
    if (first([0]) === 0 && first([false]) === false && first([""]) === "") t.pass();
    else t.fail(`first([0])=${first([0])} first([false])=${first([false])}`);
});

test("regression: last: returns falsy last element", (t) => {
    if (last([1, 0]) === 0 && last([true, false]) === false) t.pass();
    else t.fail(`last([1,0])=${last([1, 0])} last([true,false])=${last([true, false])}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Source.fromBehaviorSubject (src/utils/rx/Source.ts)
// Same falsy-replay bug as BehaviorSubject.toObserver: `subject.data && emit(...)`
// skipped replaying 0 / false / "" to a new subscriber.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: Source.fromBehaviorSubject: replays falsy current value", async (t) => {
    const bs = new BehaviorSubject(0);
    const got = [];
    Source.fromBehaviorSubject(bs).connect((v) => got.push(v));
    await sleep(10);
    if (got.length === 1 && got[0] === 0) t.pass();
    else t.fail(`expected [0], got ${JSON.stringify(got)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PubsubArrayAdapter (src/utils/hof/pubsub.ts)
// getFirst used `first || null`, so a falsy queued item was reported as null
// (queue looks empty while length() says otherwise).
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: PubsubArrayAdapter: getFirst returns falsy item", async (t) => {
    const queue = new PubsubArrayAdapter();
    await queue.push(0);
    const value = await queue.getFirst();
    if (value === 0) t.pass();
    else t.fail(`expected 0, got ${value}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// iterateDocuments (src/api/iterateDocuments.ts)
// lastId was computed as `getId(...) || null`, so a falsy id (0, "") became
// null and the cursor pagination restarted from the beginning.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: iterateDocuments: passes falsy lastId (id=0) to next request", async (t) => {
    const lastIds = [];
    const iterator = iterateDocuments({
        totalDocuments: 4,
        limit: 2,
        delay: 1,
        createRequest: ({ lastId, offset }) => {
            lastIds.push(lastId);
            if (offset >= 2) return [];
            return [{ id: -1 }, { id: 0 }];
        },
    });
    for await (const _ of iterator) { /* drain */ }
    if (lastIds[1] === 0) t.pass();
    else t.fail(`expected second request lastId=0, got ${lastIds[1]}`);
});
