import { test } from "worker-testbed";
import {
    Subject,
    BehaviorSubject,
    Source,
    Operator,
    EventEmitter,
    sleep,
} from "../../../build/index.mjs";

// ─── helpers ────────────────────────────────────────────────────────────────
//
// The whole point of this suite: assert the EXACT number of subscribers left on
// the ROOT subject, not just the boolean `hasListeners`. A boolean can't tell
// "0 left" from "2 leaked". These helpers read the real counts.

// Exact number of live listeners on the root subject's internal emitter.
// This is the true leak detector — it counts every subscription, including the
// low-level `subject.subscribe(...)` path and BehaviorSubject replay, which do
// NOT create root Observers.
const rootSubs = (subject) => {
    const events = subject._emitter._events;
    let total = 0;
    for (const key of Reflect.ownKeys(events)) {
        total += events[key].length;
    }
    return total;
};

// Number of root Observer chains attached to the subject (only counts the
// operator chains built via .map/.filter/.operator/.merge/... — not raw subscribe).
const rootObservers = (subject) => subject._rootObservers.size;

// Exact number of DATA-channel listeners on a single Observer link in a chain.
// An Observer's broadcast holds several channels (data, error, connect, disconnect);
// only the data channel (OBSERVER_EVENT, described "observer-subscribe") represents
// a real downstream subscription. This lets us assert every intermediate link of an
// operator chain is torn down — not just the root.
const dataSubs = (observer) => {
    const events = observer.broadcast._events;
    for (const key of Reflect.ownKeys(events)) {
        if (typeof key === "symbol" && key.description === "observer-subscribe") {
            return events[key].length;
        }
    }
    return 0;
};

// ═══════════════════════════════════════════════════════════════════════════════
// EventEmitter — raw subscriber counts
// ═══════════════════════════════════════════════════════════════════════════════

test("EventEmitter: getListeners count grows and shrinks with sub/unsub", (t) => {
    const em = new EventEmitter();
    if (em.getListeners("e").length !== 0) { t.fail("expected 0 initially"); return; }
    const a = () => {};
    const b = () => {};
    em.subscribe("e", a);
    em.subscribe("e", b);
    if (em.getListeners("e").length !== 2) { t.fail(`expected 2, got ${em.getListeners("e").length}`); return; }
    em.unsubscribe("e", a);
    if (em.getListeners("e").length !== 1) { t.fail(`expected 1, got ${em.getListeners("e").length}`); return; }
    em.unsubscribe("e", b);
    if (em.getListeners("e").length === 0) t.pass();
    else t.fail(`expected 0, got ${em.getListeners("e").length}`);
});

test("EventEmitter: hasListeners is false once all listeners removed", (t) => {
    const em = new EventEmitter();
    const fn = () => {};
    em.subscribe("e", fn);
    if (em.hasListeners !== true) { t.fail("should have listeners"); return; }
    em.unsubscribe("e", fn);
    if (em.hasListeners === false) t.pass();
    else t.fail("hasListeners should be false after last unsubscribe");
});

test("EventEmitter: unsubscribe on unknown key does not create listeners", (t) => {
    const em = new EventEmitter();
    em.unsubscribe("never-seen", () => {});
    if (em.hasListeners === false && em.getListeners("never-seen").length === 0) t.pass();
    else t.fail("unsubscribing an unknown key must not register anything");
});

test("EventEmitter: once registers exactly one listener, gone after emit", async (t) => {
    const em = new EventEmitter();
    em.once("e", () => {});
    if (em.getListeners("e").length !== 1) { t.fail(`expected 1, got ${em.getListeners("e").length}`); return; }
    await em.emit("e");
    if (em.getListeners("e").length === 0) t.pass();
    else t.fail(`expected 0 after once fired, got ${em.getListeners("e").length}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Root subject subscriber count — the real leak checks
// ═══════════════════════════════════════════════════════════════════════════════

test("root subs: fresh subject has 0 subscribers", (t) => {
    const s = new Subject();
    if (rootSubs(s) === 0 && rootObservers(s) === 0) t.pass();
    else t.fail(`expected 0/0, got subs=${rootSubs(s)} observers=${rootObservers(s)}`);
});

test("root subs: filter → map → once — root drops back to 0 after single fire", async (t) => {
    const s = new Subject();
    const out = [];
    s.filter(n => n % 2 === 0).map(n => n * 2).once(v => out.push(v));
    if (rootSubs(s) !== 1) { t.fail(`peak: expected 1 root sub, got ${rootSubs(s)}`); return; }
    await s.next(2); // logs 4
    await s.next(4); // noop — once already fired and unsubscribed
    if (out.length === 1 && out[0] === 4 && rootSubs(s) === 0 && rootObservers(s) === 0) t.pass();
    else t.fail(`out=${JSON.stringify(out)} rootSubs=${rootSubs(s)} rootObservers=${rootObservers(s)}`);
});

test("root subs: filter → map → connect then unsub — root back to 0", async (t) => {
    const s = new Subject();
    const out = [];
    const unsub = s.filter(n => n > 0).map(n => n * 10).connect(v => out.push(v));
    if (rootSubs(s) !== 1) { t.fail(`peak: expected 1, got ${rootSubs(s)}`); return; }
    await s.next(5);
    unsub();
    if (rootSubs(s) === 0 && rootObservers(s) === 0 && out[0] === 50) t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} rootObservers=${rootObservers(s)} out=${JSON.stringify(out)}`);
});

test("root subs: toObserver().connect then unsub — root back to 0", (t) => {
    const s = new Subject();
    const unsub = s.toObserver().connect(() => {});
    if (rootSubs(s) !== 1) { t.fail(`peak: expected 1, got ${rootSubs(s)}`); return; }
    unsub();
    if (rootSubs(s) === 0 && rootObservers(s) === 0) t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} rootObservers=${rootObservers(s)}`);
});

test("root subs: toObserver().once — unsub before fire drops root to 0", (t) => {
    const s = new Subject();
    const unsub = s.toObserver().once(() => {});
    if (rootSubs(s) !== 1) { t.fail(`peak: expected 1, got ${rootSubs(s)}`); return; }
    unsub();
    if (rootSubs(s) === 0 && rootObservers(s) === 0) t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} rootObservers=${rootObservers(s)}`);
});

test("root subs: raw subscribe() then unsub — root back to 0 (bypasses rootObservers)", async (t) => {
    const s = new Subject();
    const got = [];
    const unsub = s.subscribe(v => got.push(v));
    // raw subscribe does not create a root Observer, but IS a root emitter listener
    if (rootSubs(s) !== 1) { t.fail(`peak: expected 1 emitter listener, got ${rootSubs(s)}`); return; }
    if (rootObservers(s) !== 0) { t.fail(`raw subscribe must not add a root Observer, got ${rootObservers(s)}`); return; }
    await s.next(1);
    unsub();
    await s.next(2);
    if (rootSubs(s) === 0 && got.join(",") === "1") t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} got=${JSON.stringify(got)}`);
});

test("root subs: unsubscribeAll drops root to 0", (t) => {
    const s = new Subject();
    s.map(n => n).connect(() => {});
    s.filter(() => true).connect(() => {});
    if (rootSubs(s) !== 2) { t.fail(`peak: expected 2, got ${rootSubs(s)}`); return; }
    s.unsubscribeAll();
    if (rootSubs(s) === 0) t.pass();
    else t.fail(`rootSubs after unsubscribeAll=${rootSubs(s)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Multiple subscribers — exact count on the root at every step
// ═══════════════════════════════════════════════════════════════════════════════

test("root subs: two chains → count is 2, decrements to 1 then 0", async (t) => {
    const s = new Subject();
    const a = [], b = [];
    const ua = s.map(n => n).connect(v => a.push(v));
    const ub = s.map(n => n).connect(v => b.push(v));
    if (rootSubs(s) !== 2 || rootObservers(s) !== 2) {
        t.fail(`peak: expected 2/2, got ${rootSubs(s)}/${rootObservers(s)}`); return;
    }
    await s.next(1);
    ua();
    if (rootSubs(s) !== 1) { t.fail(`after ua: expected 1, got ${rootSubs(s)}`); return; }
    await s.next(2);
    ub();
    if (rootSubs(s) === 0 && a.join(",") === "1" && b.join(",") === "1,2") t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
});

test("root subs: five chains → count is 5, all unsub → 0", (t) => {
    const s = new Subject();
    const unsubs = [];
    for (let i = 0; i < 5; i++) unsubs.push(s.map(n => n).connect(() => {}));
    if (rootSubs(s) !== 5 || rootObservers(s) !== 5) {
        t.fail(`peak: expected 5/5, got ${rootSubs(s)}/${rootObservers(s)}`); return;
    }
    unsubs.forEach(u => u());
    if (rootSubs(s) === 0 && rootObservers(s) === 0) t.pass();
    else t.fail(`after all unsub: rootSubs=${rootSubs(s)} rootObservers=${rootObservers(s)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Operator chains — a whole chain is still ONE subscription on the root
// ═══════════════════════════════════════════════════════════════════════════════

test("root subs: distinct → skip → take chain is 1 root sub; teardown → 0", async (t) => {
    // distinct() drops *consecutive* duplicates only:
    // [1,2,3,2,1,4,5] → distinct → 1,2,3,2,1,4,5 → skip(1) → 2,3,2,1,4,5 → take(3) → 2,3,2
    const s = new Subject();
    const got = [];
    const unsub = s
        .operator(Operator.distinct())
        .operator(Operator.skip(1))
        .operator(Operator.take(3))
        .connect(v => got.push(v));
    if (rootSubs(s) !== 1) { t.fail(`chain should be exactly 1 root sub, got ${rootSubs(s)}`); return; }
    for (const v of [1, 2, 3, 2, 1, 4, 5]) await s.next(v);
    unsub();
    if (rootSubs(s) === 0 && rootObservers(s) === 0 && got.join(",") === "2,3,2") t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} got=${JSON.stringify(got)}`);
});

test("root subs: take(2) — chain stays subscribed after exhaustion (manual unsub required)", async (t) => {
    const s = new Subject();
    const got = [];
    const unsub = s.operator(Operator.take(2)).connect(v => got.push(v));
    await s.next(1);
    await s.next(2);
    await s.next(3);
    await s.next(4);
    // take does not auto-dispose the upstream; the root sub is still there
    if (rootSubs(s) !== 1) { t.fail(`expected still 1 root sub, got ${rootSubs(s)}`); return; }
    if (got.join(",") !== "1,2") { t.fail(`expected [1,2], got ${JSON.stringify(got)}`); return; }
    unsub();
    if (rootSubs(s) === 0) t.pass();
    else t.fail(`after unsub rootSubs=${rootSubs(s)}`);
});

test("root subs: Source.fromArray chain fully tears down on unsub", async (t) => {
    // Source.fromXxx are Observers, not Subjects — assert the chain unsub cleans up
    // by verifying no delivery happens after unsub.
    const got = [];
    const unsub = Source.fromInterval(10)
        .operator(Operator.distinct())
        .operator(Operator.take(3))
        .connect(v => got.push(v));
    await sleep(35);
    unsub();
    const countAtUnsub = got.length;
    await sleep(40);
    if (got.length === countAtUnsub) t.pass();
    else t.fail(`delivery continued after unsub: ${countAtUnsub} → ${got.length}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// merge — a single unsub must remove the subscriber from BOTH root subjects
// ═══════════════════════════════════════════════════════════════════════════════

test("root subs: merge — each root has 1 sub; single unsub drops BOTH to 0", async (t) => {
    const s1 = new Subject();
    const s2 = new Subject();
    const out = [];
    const unsub = s1.merge(s2.toObserver()).connect(v => out.push(v));
    await s1.next(1);
    await s2.next(2);
    if (rootSubs(s1) !== 1 || rootSubs(s2) !== 1) {
        t.fail(`peak: expected 1/1, got s1=${rootSubs(s1)} s2=${rootSubs(s2)}`); return;
    }
    unsub();
    if (rootSubs(s1) === 0 && rootSubs(s2) === 0 && out.join(",") === "1,2") t.pass();
    else t.fail(`after unsub s1=${rootSubs(s1)} s2=${rootSubs(s2)} out=${JSON.stringify(out)}`);
});

test("root subs: merge — after unsub neither root delivers", async (t) => {
    const s1 = new Subject();
    const s2 = new Subject();
    const out = [];
    const unsub = s1.merge(s2.toObserver()).connect(v => out.push(v));
    await s1.next(1);
    unsub();
    await s1.next(2);
    await s2.next(3);
    if (out.length === 1 && out[0] === 1 && rootSubs(s1) === 0 && rootSubs(s2) === 0) t.pass();
    else t.fail(`out=${JSON.stringify(out)} s1=${rootSubs(s1)} s2=${rootSubs(s2)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BehaviorSubject — replay path is a real root listener too
// ═══════════════════════════════════════════════════════════════════════════════

test("root subs: BehaviorSubject connect is 1 root sub; unsub → 0", async (t) => {
    const s = new BehaviorSubject(7);
    const out = [];
    const unsub = s.toObserver().connect(v => out.push(v));
    await s.next(8);
    if (rootSubs(s) !== 1) { t.fail(`peak: expected 1, got ${rootSubs(s)}`); return; }
    unsub();
    await s.next(9); // must not be delivered
    if (rootSubs(s) === 0 && out.join(",") === "7,8") t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} out=${JSON.stringify(out)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// toPromise / toIteratorContext — these subscribe internally; must self-clean
// ═══════════════════════════════════════════════════════════════════════════════

test("root subs: toPromise resolves and leaves 0 subscribers on root", async (t) => {
    const s = new Subject();
    const p = s.toObserver().toPromise();
    await s.next(42);
    const v = await p;
    // give the resolve callback's unsub a tick to run
    await sleep(0);
    if (v === 42 && rootSubs(s) === 0) t.pass();
    else t.fail(`v=${v} rootSubs=${rootSubs(s)}`);
});

test("root subs: toIteratorContext done() leaves 0 subscribers on root", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toObserver().toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) results.push(v);
    })();
    await s.next(1);
    await s.next(2);
    if (rootSubs(s) !== 1) { t.fail(`while iterating: expected 1, got ${rootSubs(s)}`); return; }
    done();
    await consumer;
    await sleep(0);
    if (rootSubs(s) === 0 && results.length >= 2) t.pass();
    else t.fail(`rootSubs=${rootSubs(s)} results=${JSON.stringify(results)}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Operator chains — subscriber count on EVERY intermediate link, not just the root.
// A chain leaks if an outer link unsubscribes but an inner link stays attached to
// its upstream. These tests hold references to each link and assert all → 0.
// ═══════════════════════════════════════════════════════════════════════════════

test("chain links: distinct → skip → take — every link is 1 while live, 0 after unsub", async (t) => {
    const s = new Subject();
    const distinct = s.operator(Operator.distinct());
    const skip = distinct.operator(Operator.skip(1));
    const take = skip.operator(Operator.take(3));

    // building the chain already subscribes each link to its upstream
    if (dataSubs(distinct) !== 1 || dataSubs(skip) !== 1) {
        t.fail(`pre-connect: distinct=${dataSubs(distinct)} skip=${dataSubs(skip)} (expected 1/1)`); return;
    }
    if (dataSubs(take) !== 0) { t.fail(`take should have 0 data subs before connect, got ${dataSubs(take)}`); return; }

    const got = [];
    const unsub = take.connect(v => got.push(v));
    if (
        rootSubs(s) !== 1 ||
        dataSubs(distinct) !== 1 ||
        dataSubs(skip) !== 1 ||
        dataSubs(take) !== 1
    ) {
        t.fail(`live: root=${rootSubs(s)} distinct=${dataSubs(distinct)} skip=${dataSubs(skip)} take=${dataSubs(take)}`);
        return;
    }
    for (const v of [1, 2, 3, 2, 1, 4, 5]) await s.next(v);
    unsub();
    if (
        rootSubs(s) === 0 &&
        dataSubs(distinct) === 0 &&
        dataSubs(skip) === 0 &&
        dataSubs(take) === 0 &&
        got.join(",") === "2,3,2"
    ) t.pass();
    else t.fail(`after unsub: root=${rootSubs(s)} distinct=${dataSubs(distinct)} skip=${dataSubs(skip)} take=${dataSubs(take)} got=${JSON.stringify(got)}`);
});

test("chain links: filter → map → tap — every link torn down on unsub", async (t) => {
    const s = new Subject();
    const filtered = s.filter(n => n % 2 === 0);
    const mapped = filtered.map(n => n * 2);
    const tapped = mapped.tap(() => {});
    const out = [];
    const unsub = tapped.connect(v => out.push(v));
    if (
        rootSubs(s) !== 1 ||
        dataSubs(filtered) !== 1 ||
        dataSubs(mapped) !== 1 ||
        dataSubs(tapped) !== 1
    ) {
        t.fail(`live: root=${rootSubs(s)} filter=${dataSubs(filtered)} map=${dataSubs(mapped)} tap=${dataSubs(tapped)}`);
        return;
    }
    await s.next(4); // 4 → passes filter → *2 → 8
    unsub();
    if (
        rootSubs(s) === 0 &&
        dataSubs(filtered) === 0 &&
        dataSubs(mapped) === 0 &&
        dataSubs(tapped) === 0 &&
        out.join(",") === "8"
    ) t.pass();
    else t.fail(`after unsub: root=${rootSubs(s)} filter=${dataSubs(filtered)} map=${dataSubs(mapped)} tap=${dataSubs(tapped)} out=${JSON.stringify(out)}`);
});

test("chain links: group → map — links torn down on unsub", async (t) => {
    const s = new Subject();
    const grouped = s.operator(Operator.group(2));
    const mapped = grouped.map(g => g.join("-"));
    const out = [];
    const unsub = mapped.connect(v => out.push(v));
    if (rootSubs(s) !== 1 || dataSubs(grouped) !== 1 || dataSubs(mapped) !== 1) {
        t.fail(`live: root=${rootSubs(s)} group=${dataSubs(grouped)} map=${dataSubs(mapped)}`); return;
    }
    await s.next(1);
    await s.next(2); // batch [1,2] → "1-2"
    unsub();
    if (
        rootSubs(s) === 0 &&
        dataSubs(grouped) === 0 &&
        dataSubs(mapped) === 0 &&
        out.join(",") === "1-2"
    ) t.pass();
    else t.fail(`after unsub: root=${rootSubs(s)} group=${dataSubs(grouped)} map=${dataSubs(mapped)} out=${JSON.stringify(out)}`);
});

test("chain links: two chains off one subject unsubscribe independently", async (t) => {
    const s = new Subject();
    const chainA = s.map(n => n).operator(Operator.take(10));
    const chainB = s.filter(() => true).map(n => n * 10);
    const ua = chainA.connect(() => {});
    const ub = chainB.connect(() => {});
    if (rootSubs(s) !== 2 || rootObservers(s) !== 2) {
        t.fail(`peak: root=${rootSubs(s)} observers=${rootObservers(s)} (expected 2/2)`); return;
    }
    ua();
    // chainA's links must be gone; chainB's must remain (still 1 root sub)
    if (dataSubs(chainA) !== 0) { t.fail(`chainA link should be 0 after its unsub, got ${dataSubs(chainA)}`); return; }
    if (rootSubs(s) !== 1) { t.fail(`root should be 1 after unsubbing A, got ${rootSubs(s)}`); return; }
    if (dataSubs(chainB) !== 1) { t.fail(`chainB link should still be 1, got ${dataSubs(chainB)}`); return; }
    ub();
    if (rootSubs(s) === 0 && dataSubs(chainB) === 0) t.pass();
    else t.fail(`after both unsub: root=${rootSubs(s)} chainB=${dataSubs(chainB)}`);
});

test("chain links: merge — both arms and intermediate links torn down by one unsub", async (t) => {
    const s1 = new Subject();
    const s2 = new Subject();
    const left = s1.map(n => n);           // left arm intermediate link
    const merged = left.merge(s2.toObserver());
    const out = [];
    const unsub = merged.connect(v => out.push(v));
    await s1.next(1);
    await s2.next(2);
    if (
        rootSubs(s1) !== 1 ||
        rootSubs(s2) !== 1 ||
        dataSubs(left) !== 1 ||
        dataSubs(merged) !== 1
    ) {
        t.fail(`live: s1=${rootSubs(s1)} s2=${rootSubs(s2)} left=${dataSubs(left)} merged=${dataSubs(merged)}`);
        return;
    }
    unsub();
    if (
        rootSubs(s1) === 0 &&
        rootSubs(s2) === 0 &&
        dataSubs(left) === 0 &&
        dataSubs(merged) === 0 &&
        out.join(",") === "1,2"
    ) t.pass();
    else t.fail(`after unsub: s1=${rootSubs(s1)} s2=${rootSubs(s2)} left=${dataSubs(left)} merged=${dataSubs(merged)} out=${JSON.stringify(out)}`);
});

test("chain links: rebuilding a chain after teardown does not accumulate subs", async (t) => {
    const s = new Subject();
    // connect + unsub the same shape 3 times; the root must never exceed 1 and end at 0
    let maxRoot = 0;
    for (let i = 0; i < 3; i++) {
        const unsub = s.operator(Operator.distinct()).operator(Operator.take(2)).connect(() => {});
        maxRoot = Math.max(maxRoot, rootSubs(s));
        await s.next(i);
        unsub();
        if (rootSubs(s) !== 0) { t.fail(`iteration ${i}: root should be 0 after unsub, got ${rootSubs(s)}`); return; }
    }
    if (maxRoot === 1 && rootSubs(s) === 0) t.pass();
    else t.fail(`maxRoot=${maxRoot} final=${rootSubs(s)} (expected max 1, final 0)`);
});
