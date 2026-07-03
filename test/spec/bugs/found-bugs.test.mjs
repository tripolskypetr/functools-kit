import { test } from "worker-testbed";
import {
    throttle,
    queued,
    rate,
    iterateUnion,
    LimitedMap,
    LimitedSet,
    BehaviorSubject,
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
