import { test } from "worker-testbed";
import {
    Source,
    Subject,
    BehaviorSubject,
    EventEmitter,
    Operator,
    sleep,
} from "../../../build/index.mjs";

const noUnhandled = (t) => process.on("unhandledRejection", (r) => t.fail("unhandled: " + r));

// ═══════════════════════════════════════════════════════════════════════════════
// strideTricks (src/utils/rx/lib/strideTricks.ts)
// strideSize=1 defaulted step to floor(1/2)=0, making totalSteps Infinity and
// the window loop an infinite synchronous loop (process hang / OOM). Same for
// explicit step<=0 and negative steps.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: strideTricks(1) throws instead of hanging the process", async (t) => {
    const subject = new Subject();
    const errors = [];
    const chain = subject.toObserver().operator(Operator.strideTricks(1));
    chain.onError((e) => errors.push(e));
    chain.connect(() => undefined);
    await subject.next([1, 2, 3, 4]).catch(() => undefined);
    await sleep(10);
    // reaching this line at all proves the loop terminated
    if (errors.length > 0) t.pass();
    else t.fail("expected a validation error on the error channel");
});

test("regression: strideTricks(2, -1) throws instead of hanging", async (t) => {
    const subject = new Subject();
    const errors = [];
    const chain = subject.toObserver().operator(Operator.strideTricks(2, -1));
    chain.onError((e) => errors.push(e));
    chain.connect(() => undefined);
    await subject.next([1, 2, 3, 4]).catch(() => undefined);
    await sleep(10);
    if (errors.length > 0) t.pass();
    else t.fail("expected a validation error on the error channel");
});

test("regression: strideTricks(2, 1) still produces correct windows", async (t) => {
    const subject = new Subject();
    const out = [];
    subject.toObserver().operator(Operator.strideTricks(2, 1)).connect((w) => out.push(w));
    await subject.next([1, 2, 3]);
    await sleep(10);
    if (out.length === 1 && JSON.stringify(out[0]) === "[[1,2],[2,3]]") t.pass();
    else t.fail(`got ${JSON.stringify(out)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Double error reports. connect()'s wrapper emitErrors at the throwing level
// before rethrowing; the .catch(emitError) guards in sources/retry/BS replay
// re-reported the same error a second time.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: retry(1) delivers exactly one error event per attempt", async (t) => {
    noUnhandled(t);
    const subject = new Subject();
    const errors = [];
    const chain = subject.toObserver().operator(Operator.retry(1));
    chain.onError((e) => errors.push(e));
    chain.connect(() => { throw new Error("boom"); });
    await subject.next("x").catch(() => undefined);
    await sleep(10);
    if (errors.length === 2) t.pass();
    else t.fail(`expected 2 error events for 2 attempts, got ${errors.length}`);
});

test("regression: BehaviorSubject replay throw reports exactly one error", async (t) => {
    noUnhandled(t);
    const bs = new BehaviorSubject(42);
    const obs = bs.toObserver();
    const errors = [];
    obs.onError((e) => errors.push(e));
    obs.connect(() => { throw new Error("replay-boom"); });
    await sleep(10);
    if (errors.length === 1) t.pass();
    else t.fail(`expected 1 error report, got ${errors.length}`);
});

test("regression: throwing consumer produces one onError for cold sources", async (t) => {
    noUnhandled(t);
    const counts = {};
    for (const [label, make] of [
        ["createCold", () => Source.createCold((next) => { setTimeout(() => next(1), 5); })],
        ["fromDelay", () => Source.fromDelay(5)],
        ["fromInterval", () => Source.fromInterval(1000)],
        ["join", () => Source.join([Source.fromDelay(5)])],
    ]) {
        const obs = make();
        const errors = [];
        obs.onError((e) => errors.push(e));
        obs.connect(() => { throw new Error(label + "-boom"); });
        await sleep(40);
        obs.unsubscribe && obs.unsubscribe();
        counts[label] = errors.length;
    }
    const bad = Object.entries(counts).filter(([, n]) => n !== 1);
    if (bad.length === 0) t.pass();
    else t.fail(`double/missing onError: ${JSON.stringify(counts)}`);
});

test("regression: fromPromise callback rejection is still reported exactly once", async (t) => {
    noUnhandled(t);
    const src = Source.fromPromise(async () => { throw new Error("cb-boom"); });
    const errors = [];
    src.onError((e) => errors.push(e));
    src.connect(() => undefined);
    await sleep(20);
    if (errors.length === 1) t.pass();
    else t.fail(`expected 1 report, got ${errors.length}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sibling starvation (EventEmitter.emit + fromArray). One throwing listener
// aborted the emit loop, skipping every later-subscribed listener; in
// fromArray the rejection additionally killed the item loop for everyone.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: fromArray delivers remaining items after a consumer throws", async (t) => {
    noUnhandled(t);
    const src = Source.fromArray([1, 2, 3, 4]);
    const got1 = [], got2 = [];
    src.connect((v) => { got1.push(v); if (v === 2) throw new Error("c1-boom"); });
    src.connect((v) => got2.push(v));
    await sleep(30);
    // item 1 is in-flight when c2 subscribes (snapshot semantics); the fix is
    // that 3 and 4 are no longer lost to everyone
    if (got1.join(",") === "1,2,3,4" && got2.includes(3) && got2.includes(4)) t.pass();
    else t.fail(`got1=[${got1}], got2=[${got2}]`);
});

test("regression: fromInterval later-subscribed sibling gets ticks despite earlier thrower", async (t) => {
    noUnhandled(t);
    const src = Source.fromInterval(10);
    const got2 = [];
    src.connect(() => { throw new Error("early-thrower"); });
    src.connect((i) => got2.push(i));
    await sleep(60);
    src.unsubscribe();
    if (got2.length >= 2) t.pass();
    else t.fail(`later sibling starved: got ${got2.length} ticks`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// toPromise / toIteratorContext on an already-disposed Observer (Observer.ts)
// The dispose-while-pending fix settled pending awaiters, but calling either
// method AFTER disposal registered listeners for events that already fired —
// both hung forever (including a second sequential toPromise()).
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: toPromise on a disposed observer rejects instead of hanging", async (t) => {
    const subject = new Subject();
    const obs = subject.toObserver();
    obs.unsubscribe();
    let rejected = false;
    await Promise.race([
        obs.toPromise().catch(() => { rejected = true; }),
        sleep(200),
    ]);
    if (rejected) t.pass();
    else t.fail("toPromise hung on disposed observer");
});

test("regression: second sequential toPromise settles", async (t) => {
    const subject = new Subject();
    const obs = subject.toObserver();
    const p1 = obs.toPromise();
    await subject.next("v1");
    const v1 = await p1;
    let settled = false;
    await Promise.race([
        obs.toPromise().catch(() => undefined).then(() => { settled = true; }),
        sleep(200),
    ]);
    if (v1 === "v1" && settled) t.pass();
    else t.fail(`v1=${v1}, second toPromise settled=${settled}`);
});

test("regression: iterate() on a disposed observer completes immediately", async (t) => {
    const subject = new Subject();
    const obs = subject.toObserver();
    obs.unsubscribe();
    const ctx = obs.toIteratorContext();
    let done = false;
    await Promise.race([
        (async () => { for await (const _ of ctx.iterate()) { /* nothing */ } done = true; })(),
        sleep(200),
    ]);
    if (done) t.pass();
    else t.fail("iterate() hung on disposed observer");
});

// ═══════════════════════════════════════════════════════════════════════════════
// mapAsync / flatMap unsubscribe (Observer.ts). Teardown called queued's
// clear() — which only forgets the cancel handles — so a queued invocation
// still ran the user callback after unsubscribe. Now cancel() is used.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: mapAsync queued callback does not run after unsubscribe", async (t) => {
    noUnhandled(t);
    const subject = new Subject();
    const calls = [];
    const un = subject.toObserver()
        .mapAsync(async (v) => { calls.push(v); await sleep(30); return v; })
        .connect(() => undefined);
    subject.next(1);
    subject.next(2);
    await sleep(5);
    un();
    await sleep(80);
    if (calls.join(",") === "1") t.pass();
    else t.fail(`user callback ran after unsubscribe: [${calls}]`);
});

test("regression: flatMap queued callback does not run after unsubscribe", async (t) => {
    noUnhandled(t);
    const subject = new Subject();
    const calls = [];
    const un = subject.toObserver()
        .flatMap((v) => { calls.push(v); return [v]; })
        .connect(async () => { await sleep(30); });
    subject.next(1);
    subject.next(2);
    await sleep(5);
    un();
    await sleep(80);
    if (calls.join(",") === "1") t.pass();
    else t.fail(`user callback ran after unsubscribe: [${calls}]`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// EventEmitter.once + unsubscribe(ev, cb) (EventEmitter.ts)
// once() subscribed an anonymous wrapper, so unsubscribe by the original
// callback silently no-oped (Node's EventEmitter removes once-wrappers).
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: EventEmitter.once is removable by the original callback", async (t) => {
    const ee = new EventEmitter();
    let fired = 0;
    const cb = () => { fired += 1; };
    ee.once("ev", cb);
    ee.unsubscribe("ev", cb);
    await ee.emit("ev");
    if (fired === 0) t.pass();
    else t.fail("once-wrapper survived unsubscribe by original callback");
});

test("regression: EventEmitter same callback twice survives one unsubscribe", async (t) => {
    const ee = new EventEmitter();
    let fired = 0;
    const cb = () => { fired += 1; };
    ee.subscribe("ev", cb);
    ee.subscribe("ev", cb);
    ee.unsubscribe("ev", cb);
    await ee.emit("ev");
    if (fired === 1) t.pass();
    else t.fail(`expected 1 firing, got ${fired}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// unicast / multicast unsubscribe (Source.ts + createObserver.ts)
// unicast.unsubscribe() spawned a brand-new throwaway instance and killed it,
// leaving live connections running; multicast.unsubscribe() with nothing
// cached instantiated the (side-effectful) factory just to kill it.
// ═══════════════════════════════════════════════════════════════════════════════

test("regression: unicast.unsubscribe tears down live connections", async (t) => {
    noUnhandled(t);
    let ticks = 0;
    const u = Source.unicast(() => Source.fromInterval(10));
    u.connect(() => { ticks += 1; });
    await sleep(35);
    u.unsubscribe();
    const at = ticks;
    await sleep(50);
    if (ticks === at && at >= 1) t.pass();
    else t.fail(`live connection survived unsubscribe: ${at} -> ${ticks}`);
});

test("regression: multicast.unsubscribe with nothing cached does not run the factory", async (t) => {
    let runs = 0;
    const m = Source.multicast(() => { runs += 1; return Source.createHot(() => undefined); });
    m.unsubscribe();
    if (runs === 0) t.pass();
    else t.fail(`factory instantiated ${runs} times by a bare unsubscribe`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIMITATION locks — documented behavior, not fixed. If one of these starts
// failing, the library's semantics changed: re-evaluate the docs, don't just
// "fix" the test.
// ═══════════════════════════════════════════════════════════════════════════════

test("LIMITATION lock: cold source resubscribe after full teardown is silently dead", async (t) => {
    // startup work hangs off a once(CONNECT) listener; after the last
    // unsubscribe disposes the source there is nothing left to restart it.
    // Source.multicast is the supported resubscribe tool.
    const src = Source.createCold((next) => { next("value"); });
    const got1 = [];
    const un1 = src.connect((v) => got1.push(v));
    un1();
    const got2 = [];
    const un2 = src.connect((v) => got2.push(v));
    await sleep(20);
    un2();
    if (got1.length === 1 && got2.length === 0) t.pass();
    else t.fail(`semantics changed: got1=[${got1}], got2=[${got2}]`);
});

test("LIMITATION lock: fromBehaviorSubject replays only to the first subscriber", async (t) => {
    const bs = new BehaviorSubject(100);
    const src = Source.fromBehaviorSubject(bs);
    const got1 = [], got2 = [];
    src.connect((v) => got1.push(v));
    src.connect((v) => got2.push(v));
    await sleep(10);
    if (got1.includes(100) && !got2.includes(100)) t.pass();
    else t.fail(`semantics changed: got1=[${got1}], got2=[${got2}]`);
});

test("LIMITATION lock: take() on a shared chain keeps its counter across resubscribes", async (t) => {
    const subject = new Subject();
    const chain = subject.toObserver().operator(Operator.take(2)).share();
    const got1 = [];
    const un1 = chain.connect((v) => got1.push(v));
    await subject.next(1);
    await subject.next(2);
    un1();
    const got2 = [];
    const un2 = chain.connect((v) => got2.push(v));
    await subject.next(3);
    await subject.next(4);
    un2();
    chain.unsubscribe();
    if (got1.join(",") === "1,2" && got2.length === 0) t.pass();
    else t.fail(`semantics changed: got1=[${got1}], got2=[${got2}]`);
});

test("LIMITATION lock: group() drops the partial tail group (no completion signal)", async (t) => {
    const out = [];
    Source.fromArray([1, 2, 3, 4, 5]).operator(Operator.group(2)).connect((g) => out.push(g));
    await sleep(20);
    if (JSON.stringify(out) === "[[1,2],[3,4]]") t.pass();
    else t.fail(`semantics changed: ${JSON.stringify(out)}`);
});
