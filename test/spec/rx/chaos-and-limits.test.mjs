import { test } from "worker-testbed";
import { Source, Operator, Subject, BehaviorSubject, sleep } from "../../../build/index.mjs";

// ═══════════════════════════════════════════════════════════════════════════════
// soak: the engine-clock scenario under deterministic chaos
// ═══════════════════════════════════════════════════════════════════════════════

const mulberry32 = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test("soak: shared clock survives chaotic subscribe/throw/unsubscribe churn", async (t) => {
    const rand = mulberry32(1337);
    const clock = Source.fromInterval(5).share();
    const active = [];
    for (let round = 0; round < 50; round++) {
        const dice = rand();
        if (dice < 0.3) {
            const un = clock.connect(() => {
                if (rand() < 0.3) throw new Error("chaos-" + round);
            });
            active.push(un);
        } else if (dice < 0.5) {
            const un = clock.map((x) => x).filter(() => rand() < 0.8).connect(() => {});
            active.push(un);
        } else if (dice < 0.7 && active.length) {
            const idx = Math.floor(rand() * active.length);
            active.splice(idx, 1)[0]();
        } else if (dice < 0.85) {
            await Promise.race([
                clock.map((x) => x).toPromise().catch(() => {}),
                sleep(25),
            ]);
        } else {
            const un = clock.debounce(10).connect(() => {});
            active.push(un);
        }
        await sleep(15);
    }
    while (active.length) active.pop()();
    // the clock must still tick for a fresh subscriber after all the chaos
    const ticks = [];
    const un = clock.connect((i) => ticks.push(i));
    await sleep(100);
    un();
    clock.unsubscribe();
    if (ticks.length >= 5) t.pass();
    else t.fail(`clock degraded after chaos: only ${ticks.length} ticks in 100ms`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// reentrancy: subscribers mutating the emitter mid-emission
// ═══════════════════════════════════════════════════════════════════════════════

test("reentrancy: self-unsubscribe during emit delivers exactly once", async (t) => {
    const s = new Subject();
    let calls = 0;
    const un = s.subscribe(() => {
        calls++;
        un();
    });
    await s.next(1);
    await s.next(2);
    if (calls === 1) t.pass();
    else t.fail(`expected 1 call, got ${calls}`);
});

test("reentrancy: listener subscribed mid-emission misses the current value", async (t) => {
    const s = new Subject();
    const got = [];
    s.subscribe((v) => {
        if (v === 1) s.subscribe((x) => got.push(x));
    });
    await s.next(1);
    await s.next(2);
    if (JSON.stringify(got) === "[2]") t.pass();
    else t.fail(`late subscriber saw ${JSON.stringify(got)}, expected [2]`);
});

test("reentrancy: listener A unsubscribing listener B mid-emission blocks B", async (t) => {
    const s = new Subject();
    let bHits = 0;
    let unB = () => {};
    s.subscribe(() => {
        unB();
    });
    unB = s.subscribe(() => bHits++);
    await s.next(1);
    if (bHits === 0) t.pass();
    else t.fail("B was delivered a value after being unsubscribed mid-emission");
});

test("reentrancy: recursive next() inside a subscriber completes and delivers both", async (t) => {
    const s = new Subject();
    const got = [];
    s.subscribe(async (v) => {
        got.push(v);
        if (v === 1) await s.next(2);
    });
    const r = await Promise.race([
        s.next(1).then(() => "done"),
        sleep(300).then(() => "hang"),
    ]);
    if (r === "done" && got.includes(1) && got.includes(2)) t.pass();
    else t.fail(`recursive next: ${r}, delivered ${JSON.stringify(got)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// documented limitations — locked in so a future change is deliberate
// ═══════════════════════════════════════════════════════════════════════════════

test("LIMITATION lock: retry re-delivers to healthy siblings on another's failure", async (t) => {
    const s = new Subject();
    const r = s.toObserver().operator(Operator.retry(1));
    const healthy = [];
    r.connect((v) => healthy.push(v));
    let threw = false;
    r.connect(() => {
        if (!threw) {
            threw = true;
            throw new Error("flaky");
        }
    });
    try { await s.next(7); } catch {}
    await sleep(20);
    // current behavior: the retry loop re-broadcasts, so the healthy
    // subscriber sees the value twice — changing this needs per-listener delivery
    if (healthy.length === 2 && healthy.every((v) => v === 7)) t.pass();
    else t.fail(`behavior changed: healthy sibling got ${JSON.stringify(healthy)} (was [7,7])`);
});

test("LIMITATION lock: toPromise on a retry chain rejects on the first attempt", async (t) => {
    const s = new Subject();
    const r = s.toObserver().operator(Operator.retry(2));
    let attempts = 0;
    r.connect(() => {
        attempts++;
        if (attempts === 1) throw new Error("first-only");
    });
    const p = r.toPromise();
    try { await s.next(1); } catch {}
    const result = await Promise.race([
        p.then(() => "resolved", (e) => "rejected:" + e.message),
        sleep(200).then(() => "pending"),
    ]);
    // current behavior: the throwing subscriber's emitError reaches toPromise
    // before the retry loop gets a second attempt
    if (result === "rejected:first-only") t.pass();
    else t.fail(`behavior changed: toPromise ${result}`);
});

test("LIMITATION lock: async reducers lose concurrent updates", async (t) => {
    const s = new Subject();
    const emitted = [];
    s.toObserver()
        .reduce(async (acm, cur) => {
            await sleep(10);
            return acm + cur;
        }, 0)
        .connect((v) => emitted.push(v));
    const p1 = s.next(1);
    const p2 = s.next(2);
    await Promise.all([p1, p2]);
    await sleep(30);
    // current behavior: both handlers read acm=0 concurrently — second update
    // wins with 2, the accumulated 3 is lost; use sync reducers or mapAsync
    if (JSON.stringify(emitted) === "[1,2]") t.pass();
    else t.fail(`behavior changed: reduce emitted ${JSON.stringify(emitted)} (was [1,2])`);
});

test("LIMITATION lock: bs.map() chains get no replay, bs.toObserver().map() chains do", async (t) => {
    const bs = new BehaviorSubject(5);
    const direct = [];
    const viaObserver = [];
    bs.map((x) => x).connect((v) => direct.push(v));
    bs.toObserver().map((x) => x).connect((v) => viaObserver.push(v));
    await sleep(20);
    if (direct.length === 0 && JSON.stringify(viaObserver) === "[5]") t.pass();
    else t.fail(`behavior changed: bs.map=${JSON.stringify(direct)} toObserver.map=${JSON.stringify(viaObserver)}`);
});
