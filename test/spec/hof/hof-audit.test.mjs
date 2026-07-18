import { test } from "worker-testbed";
import {
    singleshot, singletick, memoize, rate, ttl, cached, router,
    execpool, pubsub, schedule, queued, lock, debounce, throttle,
    timeout, waitForNext, Subject, sleep, PubsubArrayAdapter,
} from "../../../build/index.mjs";

// hof deep-audit regression pack: every test reproduces a confirmed bug.
// worker-testbed rethrows unhandledRejection, so "no floating rejection"
// is asserted implicitly everywhere.

// ═══════════════════════════════════════════════════════════════════════════════
// pattern A: state mutated before run() — sync throw must not poison
// ═══════════════════════════════════════════════════════════════════════════════

test("singleshot: sync throw does not poison, next call retries", async (t) => {
    let calls = 0;
    const f = singleshot(() => {
        calls++;
        if (calls === 1) throw new Error("ss-boom");
        return 42;
    });
    try { f(); } catch {}
    if (f() === 42 && calls === 2) t.pass();
    else t.fail(`poisoned: second call gave ${f()}, calls=${calls}`);
});

test("memoize: sync throw does not cache the placeholder", async (t) => {
    let calls = 0;
    const f = memoize(([k]) => k, () => {
        calls++;
        if (calls === 1) throw new Error("mm-boom");
        return "v";
    });
    try { f("a"); } catch {}
    if (f("a") === "v" && calls === 2) t.pass();
    else t.fail(`poisoned: got ${f("a")}, calls=${calls}`);
});

test("rate: sync-throwing run surfaces the real error, not a destructuring TypeError", async (t) => {
    const f = rate(() => { throw new Error("real-cause"); }, { rateName: "x", delay: 50 });
    let first, second;
    try { f(); } catch (e) { first = e.message; }
    try { f(); } catch (e) { second = e.message; }
    if (first === "real-cause" && second === "real-cause") t.pass();
    else t.fail(`masked: first=${first} second=${second}`);
});

test("cached: sync throw does not pair new args with the old value", async (t) => {
    const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
    let calls = 0;
    const f = cached(changed, (x) => {
        calls++;
        if (x === "b" && calls === 2) throw new Error("cb-boom");
        return x.toUpperCase();
    });
    f("a");
    try { f("b"); } catch {}
    if (f("b") === "B") t.pass();
    else t.fail(`served stale cross-args value: ${f("b")}`);
});

test("router: sync throw on changed args does not serve the old value", async (t) => {
    const f = router(
        ([k]) => k,
        (a, b) => a[1] !== b[1],
        (_k, v) => { if (v === 2) throw new Error("r-boom"); return v * 10; },
    );
    f("k", 1);
    try { f("k", 2); } catch {}
    let result;
    try { result = f("k", 2); } catch { result = "threw-again"; }
    if (result !== 10) t.pass();
    else t.fail("router served the value computed for the previous args");
});

test("singletick: declared clear() exists and works", async (t) => {
    const st = singletick(() => 1);
    if (typeof st.clear !== "function") {
        t.fail("singletick.clear is not a function");
        return;
    }
    st();
    st.clear();
    t.pass();
});

// ═══════════════════════════════════════════════════════════════════════════════
// pattern C: stale rejection must not evict a newer entry
// ═══════════════════════════════════════════════════════════════════════════════

test("memoize: stale rejection keeps the newer cached entry", async (t) => {
    let computes = 0;
    let rejectFirst;
    const f = memoize(([k]) => k, () => {
        computes++;
        if (computes === 1) return new Promise((_, rej) => { rejectFirst = rej; });
        return "v" + computes;
    });
    f("k").catch(() => {});
    f.clear("k");
    f("k"); // newer entry
    rejectFirst(new Error("old"));
    await sleep(10);
    f("k"); // must hit cache, not recompute
    if (computes === 2) t.pass();
    else t.fail(`stale rejection evicted the newer entry: ${computes} computes`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// execpool
// ═══════════════════════════════════════════════════════════════════════════════

test("execpool: backlog refills the pool to maxExec, not serial drain", async (t) => {
    const pool = execpool(async () => { await sleep(100); return 1; }, { maxExec: 3, delay: 1 });
    const started = Date.now();
    await Promise.all([pool(), pool(), pool(), pool(), pool(), pool()]);
    const took = Date.now() - started;
    if (took < 350) t.pass();
    else t.fail(`6 tasks of 100ms at maxExec=3 took ${took}ms (serial drain)`);
});

test("execpool: clear() rejects queued callers with a clean error", async (t) => {
    const pool = execpool(async () => { await sleep(50); return 1; }, { maxExec: 1, delay: 1 });
    pool().catch(() => {});
    const queuedCall = pool();
    await sleep(10);
    pool.clear();
    const r = await Promise.race([
        queuedCall.then(() => "resolved", (e) => "rejected:" + e.message),
        sleep(500).then(() => "hang"),
    ]);
    if (r === "rejected:functools-kit execpool cleared") t.pass();
    else t.fail(`queued caller got: ${r}`);
});

test("execpool: synchronously throwing run is attributed to its own caller", async (t) => {
    const pool = execpool(() => { throw new Error("sync-run"); }, { maxExec: 2 });
    const r = await pool().then(() => "resolved", (e) => "rejected:" + e.message);
    if (r === "rejected:sync-run") t.pass();
    else t.fail(`got ${r}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// pubsub
// ═══════════════════════════════════════════════════════════════════════════════

test("pubsub: stop() settles pending publishers promptly", async (t) => {
    const p = pubsub(async () => false, { timeout: 10_000 });
    const pending = p("m1").then(() => "resolved", () => "rejected");
    await sleep(30);
    await p.stop();
    const r = await Promise.race([pending, sleep(500).then(() => "hang")]);
    if (r === "rejected") t.pass();
    else t.fail(`publisher ${r} after stop`);
});

test("pubsub: maxItems overflow settles the dropped publisher", async (t) => {
    const p = pubsub(async () => { await sleep(50); return true; }, { queue: new PubsubArrayAdapter(1) });
    const a = p("a").then(() => "res-a", () => "rej-a");
    const b = p("b").then(() => "res-b", () => "rej-b");
    const ra = await Promise.race([a, sleep(3_000).then(() => "hang")]);
    const rb = await Promise.race([b, sleep(3_000).then(() => "hang")]);
    await p.stop();
    if (ra !== "hang" && rb !== "hang") t.pass();
    else t.fail(`dropped publisher hung: a=${ra} b=${rb}`);
});

test("pubsub: throwing onEnd does not re-deliver the message", async (t) => {
    const delivered = [];
    const p = pubsub(
        async (data) => { delivered.push(data); return true; },
        { onEnd: async () => { throw new Error("onEnd-boom"); } },
    );
    await p("x");
    await p("y");
    await sleep(50);
    await p.stop();
    const dupes = delivered.filter((v) => v === "x").length;
    if (dupes === 1) t.pass();
    else t.fail(`message delivered ${dupes} times after onEnd throw`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// schedule / queued / lock
// ═══════════════════════════════════════════════════════════════════════════════

test("schedule: args committed during execution are drained, not dropped", async (t) => {
    const executed = [];
    const fn = schedule(async (v) => { executed.push(v); await sleep(60); return v; }, {
        onSchedule: async () => {},
        delay: 10,
    });
    const pa = fn("A");
    await sleep(10);
    const pb = fn("B");
    await sleep(80); // B is executing now
    const pc = fn("C");
    await Promise.all([pa, pb, pc]);
    await sleep(200);
    if (executed.includes("C")) t.pass();
    else t.fail(`late commit dropped: executed=${JSON.stringify(executed)}`);
});

test("queued: cancel() preserves serialization for subsequent calls", async (t) => {
    const log = [];
    const q = queued(async (v) => {
        log.push("start" + v);
        await sleep(40);
        log.push("end" + v);
    });
    q(1);
    await sleep(5);
    q.cancel();
    q(2);
    await sleep(150);
    if (JSON.stringify(log) === JSON.stringify(["start1", "end1", "start2", "end2"])) t.pass();
    else t.fail(`concurrent execution after cancel: ${JSON.stringify(log)}`);
});

test("lock: cancel() prevents a queued waiter from running", async (t) => {
    const log = [];
    const fn = lock(async (v) => { log.push(v); });
    await fn.beginLock();
    fn("x").catch(() => {});
    await sleep(10);
    fn.cancel();
    await sleep(40);
    if (log.length === 0) t.pass();
    else t.fail(`canceled waiter executed: ${JSON.stringify(log)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// timers and error channels
// ═══════════════════════════════════════════════════════════════════════════════

test("debounce/throttle: async rejections from timers never float", async (t) => {
    const d = debounce(async () => { throw new Error("d-boom"); }, 15);
    d();
    const th = throttle(async () => { throw new Error("t-boom"); }, 15);
    th();
    await sleep(5);
    th();
    await sleep(100);
    t.pass(); // worker-testbed would crash the test on any unhandled rejection
});

test("timeout: fast resolution wins the race and returns the value", async (t) => {
    const f = timeout(async () => "fast", 5_000);
    const started = Date.now();
    const v = await f();
    if (v === "fast" && Date.now() - started < 200) t.pass();
    else t.fail(`got ${String(v)}`);
});

test("waitForNext: throwing condition settles the waiter", async (t) => {
    const s = new Subject();
    const p = waitForNext(s, () => { throw new Error("cond-boom"); });
    s.next(1).catch(() => {});
    const r = await Promise.race([
        p.then(() => "resolved", (e) => "rejected:" + e.message),
        sleep(300).then(() => "hang"),
    ]);
    if (r === "rejected:cond-boom") t.pass();
    else t.fail(`waiter ${r}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ttl / rate API and semantics
// ═══════════════════════════════════════════════════════════════════════════════

test("ttl: pending computation is not expired (no stampede)", async (t) => {
    let calls = 0;
    const f = ttl(() => { calls++; return sleep(80).then(() => "v"); }, {
        key: ([k]) => k,
        timeout: 20,
    });
    f("k");
    await sleep(30);
    f("k");
    await sleep(30);
    f("k");
    await sleep(150);
    if (calls === 1) t.pass();
    else t.fail(`stampede: ${calls} concurrent computes for one key`);
});

test("ttl: clear(0) does not wipe other keys' overrides; has/get/keys work", async (t) => {
    const f = ttl((x) => x, { key: ([x]) => x, timeout: 5_000 });
    f(0);
    f(1);
    f.setTimeout(1, 9_999);
    f.clear(0);
    if (f.has(1) === true && f.get(1) === 1 && f.keys().length === 1) t.pass();
    else t.fail(`falsy-key clear broke state: has=${f.has(1)} get=${f.get(1)}`);
});

test("ttl: rejected promise still evicts so the next call retries", async (t) => {
    let calls = 0;
    const f = ttl(async () => { calls++; if (calls === 1) throw new Error("fail"); return "ok"; }, {
        key: () => "k",
        timeout: 5_000,
    });
    try { await f(); } catch {}
    await sleep(5);
    const v = await f();
    if (v === "ok" && calls === 2) t.pass();
    else t.fail(`rejection cached: calls=${calls} v=${v}`);
});

test("rate: declared IControl API exists at runtime", async (t) => {
    const f = rate((x) => x * 2, { key: ([x]) => x, delay: 1_000 });
    f(5);
    if (f.has(5) && f.get(5) === 10 && f.values().length === 1 && f.keys().length === 1) t.pass();
    else t.fail("has/get/values/keys missing or wrong");
});
