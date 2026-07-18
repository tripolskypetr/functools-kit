import { test } from "worker-testbed";
import { Source, Operator, Subject, sleep } from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// found bugs — reproduced, must stay fixed
// ═══════════════════════════════════════════════════════════════════════════════

test("Subject.unsubscribeAll: clears _rootObservers registry", async (t) => {
    const subj = new Subject();
    subj.toObserver().connect(() => {});
    subj.toObserver().connect(() => {});
    subj.map((x) => x).connect(() => {});
    if (subj._rootObservers.size !== 3) {
        t.fail(`precondition failed: expected 3 root observers, got ${subj._rootObservers.size}`);
        return;
    }
    subj.unsubscribeAll();
    if (subj._rootObservers.size === 0) t.pass();
    else t.fail(`unsubscribeAll leaked ${subj._rootObservers.size} root observers`);
});

test("EventEmitter: double subscribe of same fn survives a single unsubscribe", async (t) => {
    const subj = new Subject();
    let hits = 0;
    const fn = () => hits++;
    const un1 = subj.subscribe(fn);
    subj.subscribe(fn);
    un1();
    await subj.next("x");
    if (hits === 1) t.pass();
    else t.fail(`expected 1 hit, got ${hits} (unsubscribe removed all copies)`);
});

test("merge: multicast-wrapped right side forwards errors to toPromise", async (t) => {
    const bad = Source.multicast(() =>
        Source.fromValue(1).map(() => {
            throw new Error("mc-boom");
        }),
    );
    const left = new Subject().toObserver();
    const result = await Promise.race([
        left.merge(bad).toPromise().then(
            () => "resolved",
            (e) => "rejected:" + e.message,
        ),
        sleep(500).then(() => "hung"),
    ]);
    if (result === "rejected:mc-boom") t.pass();
    else t.fail(`multicast right-side error not forwarded: "${result}"`);
});

test("join: multicast input forwards errors to toPromise", async (t) => {
    const bad = Source.multicast(() =>
        Source.fromValue(1).map(() => {
            throw new Error("mc-join-boom");
        }),
    );
    const result = await Promise.race([
        Source.join([bad]).toPromise().then(
            () => "resolved",
            (e) => "rejected:" + e.message,
        ),
        sleep(500).then(() => "hung"),
    ]);
    if (result === "rejected:mc-join-boom") t.pass();
    else t.fail(`multicast join input error not forwarded: "${result}"`);
});

test("fromArray: no emissions after dispose mid-iteration", async (t) => {
    const arr = Source.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const got = [];
    const un = arr.connect(async (v) => {
        got.push(v);
        await sleep(30);
    });
    await sleep(45); // a couple of items delivered, iteration mid-flight
    un();
    const leftovers = [];
    arr.connect((v) => leftovers.push(v));
    await sleep(200);
    if (leftovers.length === 0) t.pass();
    else t.fail(`zombie fromArray delivered ${JSON.stringify(leftovers)} after dispose`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// regression probes — verified clean, locking the behavior in
// ═══════════════════════════════════════════════════════════════════════════════

test("flatMap: chain keeps working after a subscriber throw", async (t) => {
    const values = [];
    const chain = Source.fromInterval(20).flatMap((i) => [i, i]);
    const un = chain.connect((v) => {
        values.push(v);
        if (v === 0) throw new Error("fm-boom");
    });
    await sleep(120);
    un();
    if (values.filter((v) => v >= 1).length >= 2) t.pass();
    else t.fail(`flatMap died after throw: ${JSON.stringify(values)}`);
});

test("liveness: dispose stops the internal watchdog interval", async (t) => {
    let fallbackCalls = 0;
    const src = new Subject();
    const live = src.toObserver().operator(Operator.liveness(() => fallbackCalls++, 50));
    const un = live.connect(() => {});
    un();
    await sleep(250);
    if (fallbackCalls === 0) t.pass();
    else t.fail(`zombie watchdog fired fallback ${fallbackCalls}x after dispose`);
});

test("take(1).toPromise: resolving disposes the whole chain, interval stops", async (t) => {
    let taps = 0;
    const v = await Source.fromInterval(20)
        .tap(() => taps++)
        .operator(Operator.take(1))
        .toPromise();
    const tapsAtResolve = taps;
    await sleep(150);
    if (v === 0 && taps === tapsAtResolve) t.pass();
    else t.fail(`interval still ticking after take(1) resolve: ${tapsAtResolve} -> ${taps}`);
});

test("merge: unsubscribe releases right-side cold source cleanup", async (t) => {
    let cleaned = false;
    const right = Source.createCold(() => () => {
        cleaned = true;
    });
    const merged = new Subject().toObserver().merge(right);
    const un = merged.connect(() => {});
    un();
    if (cleaned) t.pass();
    else t.fail("right-side cold source cleanup not called on merge dispose");
});

test("fromPromise: dispose before resolve cancels emission, rejection stays handled", async (t) => {
    let emitted = false;
    const obs = Source.fromPromise(async () => {
        await sleep(50);
        return 42;
    });
    const un = obs.connect(() => {
        emitted = true;
    });
    un();
    const obs2 = Source.fromPromise(async () => {
        await sleep(30);
        throw new Error("fp-boom");
    });
    const un2 = obs2.connect(() => {});
    un2();
    await sleep(150);
    if (!emitted) t.pass();
    else t.fail("fromPromise emitted after cancel");
});
