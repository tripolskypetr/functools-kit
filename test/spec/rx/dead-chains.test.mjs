import { test } from "worker-testbed";
import { Source, Subject, BehaviorSubject, sleep } from "../../../build/index.mjs";

// note: worker-testbed rethrows any unhandledRejection inside the worker,
// so every test here implicitly asserts "no floating rejected promises"

// ═══════════════════════════════════════════════════════════════════════════════
// debounce: dispose with a pending timer must settle the upstream emit
// ═══════════════════════════════════════════════════════════════════════════════

test("debounce: dispose mid-pending does not freeze a shared source", async (t) => {
    const clock = Source.fromInterval(30).share();
    const values = [];
    const unPlain = clock.connect((i) => values.push(i));
    const unDeb = clock.debounce(1_000).connect(() => {});
    await sleep(45); // a tick is now stuck awaiting the debounce timer
    unDeb();
    await sleep(300);
    unPlain();
    clock.unsubscribe();
    if (values.length > 4) t.pass();
    else t.fail(`source frozen after debounce dispose, plain listener got ${JSON.stringify(values)}`);
});

test("debounce: dispose settles the pending upstream emit promise", async (t) => {
    const subj = new Subject();
    const un = subj.toObserver().debounce(1_000).connect(() => {});
    const nextPromise = subj.next("a"); // pends until debounce timer or dispose
    await sleep(50);
    un();
    const result = await Promise.race([
        nextPromise.then(() => "settled"),
        sleep(500).then(() => "hung"),
    ]);
    if (result === "settled") t.pass();
    else t.fail("subject.next() still pending after debounce dispose");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Source.join: error propagation in both directions
// ═══════════════════════════════════════════════════════════════════════════════

test("join: input chain error propagates to toPromise", async (t) => {
    const bad = Source.fromValue(1).map(() => {
        throw new Error("input-boom");
    });
    const result = await Promise.race([
        Source.join([bad]).toPromise().then(
            () => "resolved",
            (e) => "rejected:" + e.message,
        ),
        sleep(500).then(() => "hung"),
    ]);
    if (result === "rejected:input-boom") t.pass();
    else t.fail(`expected rejection with input error, got "${result}"`);
});

test("join: throwing subscriber surfaces via onError, no unhandled rejection", async (t) => {
    const a = new BehaviorSubject(1);
    const b = new BehaviorSubject(2);
    const joined = Source.join([Source.fromSubject(a), Source.fromSubject(b)]);
    const errors = [];
    const unErr = joined.onError((e) => errors.push(e));
    const un = joined.connect(() => {
        throw new Error("join-boom");
    });
    await a.next(10);
    await b.next(20);
    await sleep(50);
    un();
    unErr();
    if (errors.some((e) => e instanceof Error && e.message === "join-boom")) t.pass();
    else t.fail("subscriber error lost by join");
});

// ═══════════════════════════════════════════════════════════════════════════════
// repeat: timer-driven re-emit must not drop rejections
// ═══════════════════════════════════════════════════════════════════════════════

test("repeat: throw on timer re-emit is forwarded, no unhandled rejection", async (t) => {
    const subj = new Subject();
    const rep = subj.toObserver().repeat(30);
    const errors = [];
    const unErr = rep.onError((e) => errors.push(e));
    let count = 0;
    const un = rep.connect(() => {
        count++;
        if (count >= 2) throw new Error("repeat-boom");
    });
    await subj.next("x"); // first delivery is fine
    await sleep(100); // timer re-emits into the throwing subscriber
    un();
    unErr();
    if (errors.some((e) => e instanceof Error && e.message === "repeat-boom")) t.pass();
    else t.fail("error from repeat timer path lost");
});

// ═══════════════════════════════════════════════════════════════════════════════
// BehaviorSubject replay: emit on connect must not float
// ═══════════════════════════════════════════════════════════════════════════════

test("BehaviorSubject: throw on replayed value forwarded, no unhandled rejection", async (t) => {
    const bs = new BehaviorSubject("seed");
    const obs = bs.toObserver();
    const errors = [];
    const unErr = obs.onError((e) => errors.push(e));
    const un = obs.connect(() => {
        throw new Error("replay-boom");
    });
    await sleep(50);
    un();
    unErr();
    if (errors.some((e) => e instanceof Error && e.message === "replay-boom")) t.pass();
    else t.fail("replay error lost");
});

test("Source.fromBehaviorSubject: throw on replayed value forwarded, no unhandled rejection", async (t) => {
    const bs = new BehaviorSubject("seed");
    const obs = Source.fromBehaviorSubject(bs);
    const errors = [];
    const unErr = obs.onError((e) => errors.push(e));
    const un = obs.connect(() => {
        throw new Error("replay-boom");
    });
    await sleep(50);
    un();
    unErr();
    if (errors.some((e) => e instanceof Error && e.message === "replay-boom")) t.pass();
    else t.fail("replay error lost");
});
