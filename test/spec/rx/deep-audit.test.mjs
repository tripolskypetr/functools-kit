import { test } from "worker-testbed";
import { Source, Operator, Subject, BehaviorSubject, cancelable, sleep } from "../../../build/index.mjs";

// deep-audit regression pack: every test reproduces a bug confirmed during
// the multi-agent rx audit. worker-testbed rethrows unhandledRejection, so
// "no floating rejection" is asserted implicitly everywhere.

const countErrorListeners = (observer) => {
    const events = observer.broadcast._events;
    const key = Reflect.ownKeys(events).find((k) => k.description === "observer-error");
    return key ? events[key].length : 0;
};

test("shared node keeps upstream error forwarder after child churn", async (t) => {
    const src = new Subject();
    const root = src.toObserver();
    const shared = root.map((x) => x).share();
    const un1 = shared.map((y) => y).connect(() => {});
    un1();
    shared.map((y) => y).connect(() => {});
    if (countErrorListeners(root) === 1) t.pass();
    else t.fail("upstream errorForwarder severed by shared-node child churn");
});

test("toPromise settles when observer is disposed while pending", async (t) => {
    const src = Source.createCold(() => () => {});
    const p = src.toPromise();
    src.unsubscribe();
    const r = await Promise.race([
        p.then(() => "resolved", () => "rejected"),
        sleep(300).then(() => "hang"),
    ]);
    if (r === "rejected") t.pass();
    else t.fail(`expected rejection, got ${r}`);
});

test("toIteratorContext: sync error during connect throws instead of hanging", async (t) => {
    const ctx = Source.createCold((next) => { next(1); })
        .map(() => { throw new Error("it-sync"); })
        .toIteratorContext();
    const r = await Promise.race([
        (async () => {
            try { for await (const v of ctx.iterate()) {} return "completed"; }
            catch (e) { return "threw:" + e.message; }
        })(),
        sleep(300).then(() => "hang"),
    ]);
    if (r === "threw:it-sync") t.pass();
    else t.fail(`expected throw, got ${r}`);
});

test("toIteratorContext: error arriving before iterate() is rethrown, not swallowed", async (t) => {
    const s = new Subject();
    const ctx = s.toObserver().map(() => { throw new Error("pre-it"); }).toIteratorContext();
    try { await s.next(1); } catch {}
    const r = await Promise.race([
        (async () => {
            try { for await (const v of ctx.iterate()) {} return "silent"; }
            catch (e) { return "threw:" + e.message; }
        })(),
        sleep(300).then(() => "hang"),
    ]);
    if (r === "threw:pre-it") t.pass();
    else t.fail(`expected throw, got ${r}`);
});

test("queued: follower call survives predecessor rejection (flatMap)", async (t) => {
    const s = new Subject();
    const got = [];
    s.toObserver()
        .flatMap((v) => { if (v === 1) throw new Error("q-boom"); return [v]; })
        .connect((v) => got.push(v));
    const p1 = s.next(1).catch(() => {});
    const p2 = s.next(2).catch((e) => "stolen:" + e.message);
    await p1;
    const r2 = await p2;
    await sleep(20);
    if (got.includes(2) && r2 === undefined) t.pass();
    else t.fail(`v2 dropped or poisoned: delivered=${JSON.stringify(got)} next2=${r2}`);
});

test("Subject.next: error handlers cleaned up on rejecting emit", async (t) => {
    const s = new Subject();
    const root = s.toObserver();
    root.connect(() => { throw new Error("n-boom"); });
    for (let i = 0; i < 3; i++) { try { await s.next(i); } catch {} }
    if (countErrorListeners(root) === 0) t.pass();
    else t.fail(`leaked ${countErrorListeners(root)} error handlers after failed next()`);
});

test("dispose idempotency: iterator done-while-iterating runs user cleanup once", async (t) => {
    let cleanups = 0;
    const src = Source.createCold((next) => {
        const timer = setInterval(() => next(1), 20);
        return () => { cleanups++; clearInterval(timer); };
    });
    const ctx = src.toIteratorContext();
    (async () => { for await (const v of ctx.iterate()) {} })();
    await sleep(50);
    ctx.done();
    await sleep(30);
    if (cleanups === 1) t.pass();
    else t.fail(`cleanup ran ${cleanups} times`);
});

test("dispose idempotency: retry teardown runs target cleanup once", async (t) => {
    let cleanups = 0;
    const un = Source.createCold(() => () => cleanups++)
        .operator(Operator.retry(2))
        .connect(() => {});
    un();
    if (cleanups === 1) t.pass();
    else t.fail(`cleanup ran ${cleanups} times`);
});

test("dispose idempotency: once() unsubscriber after fire runs cleanup once", async (t) => {
    let cleanups = 0;
    const src = Source.createCold((next) => { next(42); return () => cleanups++; });
    const off = src.once(() => {});
    await sleep(20);
    off();
    if (cleanups === 1) t.pass();
    else t.fail(`cleanup ran ${cleanups} times`);
});

test("join: legitimately emitted undefined participates in tuples", async (t) => {
    const a = new Subject();
    const b = new Subject();
    const got = [];
    Source.join([Source.fromSubject(a), Source.fromSubject(b)]).connect((v) => got.push(v));
    await a.next(1);
    await b.next(undefined);
    await sleep(20);
    if (got.length === 1 && got[0][0] === 1 && got[0][1] === undefined) t.pass();
    else t.fail(`undefined poisoned join: ${JSON.stringify(got)}`);
});

test("fromValue: synchronously throwing factory surfaces on error channel", async (t) => {
    const errors = [];
    const obs = Source.fromValue(() => { throw new Error("sync-factory"); });
    obs.onError((e) => errors.push(e.message));
    obs.connect(() => {});
    await sleep(20);
    if (errors.includes("sync-factory")) t.pass();
    else t.fail("factory throw lost");
});

test("strideTricks: tail window is emitted when strides align", async (t) => {
    const got = [];
    Source.fromValue([1, 2, 3, 4, 5, 6, 7, 8])
        .operator(Operator.strideTricks(4))
        .connect((v) => got.push(v));
    await sleep(20);
    const expected = [[[1, 2, 3, 4], [3, 4, 5, 6], [5, 6, 7, 8]]];
    if (JSON.stringify(got) === JSON.stringify(expected)) t.pass();
    else t.fail(`tail window dropped: ${JSON.stringify(got)}`);
});

test("strideTricks: invalid config throws on every buffer, not just the first", async (t) => {
    const s = new Subject();
    s.toObserver().operator(Operator.strideTricks(2, 5)).connect(() => {});
    let threw = 0;
    for (let i = 0; i < 2; i++) {
        try { await s.next([1, 2, 3, 4, 5, 6, 7]); } catch { threw++; }
    }
    if (threw === 2) t.pass();
    else t.fail(`guard fired ${threw}/2 times`);
});

test("repeat: no timer without downstream listeners, no stale replay", async (t) => {
    const s = new Subject();
    const rep = s.toObserver().repeat(10);
    await s.next("stale");
    await sleep(40);
    const got = [];
    const un = rep.connect((v) => got.push(v));
    await sleep(35);
    un();
    if (got.length === 0) t.pass();
    else t.fail(`late subscriber received stale replays: ${JSON.stringify(got)}`);
});

test("Subject.onError delivers operator-chain errors", async (t) => {
    const s = new Subject();
    const heard = [];
    const unErr = s.onError((e) => heard.push(e.message));
    s.map(() => { throw new Error("sibling"); }).connect(() => {});
    try { await s.next(1); } catch {}
    await sleep(20);
    unErr();
    if (heard.includes("sibling")) t.pass();
    else t.fail("Subject.onError never fired for chain error");
});

test("error dedup: one throw delivers once to leaf onError, not once per level", async (t) => {
    const s = new Subject();
    let deliveries = 0;
    const leaf = s.toObserver().map((x) => x).map((x) => x).map(() => { throw new Error("dup"); });
    leaf.onError(() => deliveries++);
    leaf.connect(() => {});
    try { await s.next(1); } catch {}
    await sleep(20);
    if (deliveries === 1) t.pass();
    else t.fail(`error delivered ${deliveries} times`);
});

test("createCold: downstream throw does not float, lands on error channel", async (t) => {
    const errors = [];
    const src = Source.createCold((next) => { next("v"); });
    src.onError((e) => errors.push(e.message));
    src.connect(() => { throw new Error("cold-cb"); });
    await sleep(20);
    if (errors.includes("cold-cb")) t.pass();
    else t.fail("downstream throw lost by createCold");
});

test("pipe: target-chain errors reach the pipe output", async (t) => {
    const errors = [];
    const target = Source.fromValue(1).map(() => { throw new Error("pipe-target"); });
    const piped = Source.pipe(target, (subj, next) => subj.subscribe((v) => next(v)));
    piped.onError((e) => errors.push(e.message));
    piped.connect(() => {});
    await sleep(20);
    if (errors.includes("pipe-target")) t.pass();
    else t.fail("target error lost by pipe");
});

test("retry: exhausted retries land on the operator's own error channel", async (t) => {
    const s = new Subject();
    const errors = [];
    const r = s.toObserver().operator(Operator.retry(1));
    r.onError((e) => errors.push(e.message));
    r.connect(() => { throw new Error("retry-x"); });
    try { await s.next(1); } catch {}
    await sleep(20);
    if (errors.includes("retry-x")) t.pass();
    else t.fail("exhausted-retries error misrouted");
});

test("EventEmitter.once fires exactly once under interleaved async emits", async (t) => {
    const s = new Subject();
    let calls = 0;
    s.subscribe(async () => { await sleep(30); });
    s.once(() => calls++);
    s.next(1);
    s.next(2);
    await sleep(120);
    if (calls === 1) t.pass();
    else t.fail(`once fired ${calls} times`);
});

test("no delivery to a listener unsubscribed mid-emission", async (t) => {
    const s = new Subject();
    let lateHits = 0;
    s.subscribe(async () => { await sleep(30); });
    const un = s.subscribe(() => lateHits++);
    const p = s.next(1);
    await sleep(5);
    un();
    await p;
    if (lateHits === 0) t.pass();
    else t.fail("value delivered after unsubscribe returned");
});

test("BehaviorSubject replays an explicitly stored null", async (t) => {
    const bs = new BehaviorSubject();
    await bs.next(null);
    const got = [];
    bs.toObserver().connect((v) => got.push(v));
    await sleep(20);
    if (got.length === 1 && got[0] === null) t.pass();
    else t.fail(`explicit null not replayed: ${JSON.stringify(got)}`);
});

test("Subject operator methods subscribe lazily: hasListeners stays false", async (t) => {
    const s = new Subject();
    s.map((x) => x); // no downstream connect
    if (s.hasListeners === false) t.pass();
    else t.fail("dangling operator chain flipped hasListeners");
});

test("cancelable: rejection caught by caller leaves no unhandled rejection", async (t) => {
    const fn = cancelable(async () => { throw new Error("c-boom"); });
    try { await fn(); } catch {}
    await sleep(20);
    t.pass();
});

test("fromPromise: fallbackfn not invoked after cancel", async (t) => {
    let fallbacks = 0;
    const obs = Source.fromPromise(
        async () => { await sleep(20); throw new Error("fp"); },
        () => fallbacks++,
    );
    const un = obs.connect(() => {});
    un();
    await sleep(80);
    if (fallbacks === 0) t.pass();
    else t.fail("fallbackfn fired after cancel");
});
