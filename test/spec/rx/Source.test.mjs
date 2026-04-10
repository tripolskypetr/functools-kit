import { test } from "tape";
import { Source, Subject, BehaviorSubject } from "../../../build/index.mjs";

const collect = (obs, n) => new Promise((resolve) => {
    const results = [];
    const state = { unsub: () => {} };
    state.unsub = obs.connect((v) => {
        results.push(v);
        if (results.length === n) { state.unsub(); resolve(results); }
    });
});

test("Source.fromValue: scalar", async (t) => {
    const results = await collect(Source.fromValue(7), 1);
    t.deepEqual(results, [7]);
});

test("Source.fromValue: factory fn", async (t) => {
    const results = await collect(Source.fromValue(() => 99), 1);
    t.deepEqual(results, [99]);
});

test("Source.fromArray: flat", async (t) => {
    const results = await collect(Source.fromArray([1, 2, 3]), 3);
    t.deepEqual(results, [1, 2, 3]);
});

test("Source.fromArray: nested", async (t) => {
    const results = await collect(Source.fromArray([[1, [2]], 3]), 3);
    t.deepEqual(results, [1, 2, 3]);
});

test("Source.fromPromise: resolves", async (t) => {
    const results = await collect(Source.fromPromise(async () => 42), 1);
    t.deepEqual(results, [42]);
});

test("Source.fromDelay: fires after delay", async (t) => {
    const start = Date.now();
    await collect(Source.fromDelay(50), 1);
    t.ok(Date.now() - start >= 45);
});

test("Source.fromInterval: emits counter", async (t) => {
    const results = await collect(Source.fromInterval(20), 3);
    t.deepEqual(results, [0, 1, 2]);
});

test("Source.createCold: starts on connect, cleanup on disconnect", async (t) => {
    let cleaned = false;
    const obs = Source.createCold((next) => {
        next(1);
        return () => { cleaned = true; };
    });
    const state = { unsub: () => {} };
    await new Promise((resolve) => {
        state.unsub = obs.connect((v) => resolve(v));
    });
    state.unsub();
    t.equal(cleaned, true);
});

test("Source.createHot: factory called once at creation", (t) => {
    let calls = 0;
    Source.createHot((_next) => { calls++; });
    t.equal(calls, 1, "emitter runs immediately, not per subscriber");
    t.end();
});


test("Source.merge: combines observers", async (t) => {
    const results = await collect(
        Source.merge([Source.fromValue(1), Source.fromValue(2), Source.fromValue(3)]), 3
    );
    t.deepEqual(results.sort((a, b) => a - b), [1, 2, 3]);
});

test("Source.join: emits tuple when all emitted", async (t) => {
    const results = await collect(
        Source.join([Source.fromValue("x"), Source.fromValue(1)]), 1
    );
    t.deepEqual(results, [["x", 1]]);
});

test("Source.join: race=true emits on each update", async (t) => {
    const a = new Subject();
    const b = new Subject();
    const results = [];
    const unsub = Source.join(
        [Source.fromSubject(a), Source.fromSubject(b)],
        { race: true, buffer: ["a0", "b0"] }
    ).connect((v) => results.push(v));
    await a.next("a1");
    await b.next("b1");
    unsub();
    t.ok(results.length >= 1);
});

test("Source.fromSubject: forwards emissions", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = Source.fromSubject(s).connect((v) => results.push(v));
    await s.next(10);
    await s.next(20);
    unsub();
    t.deepEqual(results, [10, 20]);
});

test("Source.fromBehaviorSubject: replays then forwards", async (t) => {
    const s = new BehaviorSubject(5);
    const results = [];
    const unsub = Source.fromBehaviorSubject(s).connect((v) => results.push(v));
    await s.next(6);
    unsub();
    t.deepEqual(results, [5, 6]);
});

test("Source.unicast: new instance per subscriber", async (t) => {
    let n = 0;
    const s1 = new Subject();
    const s2 = new Subject();
    const sources = [s1, s2];
    const uni = Source.unicast(() => { return Source.fromSubject(sources[n++]); });
    const r1 = [], r2 = [];
    const u1 = uni.connect((v) => r1.push(v));
    const u2 = uni.connect((v) => r2.push(v));
    await s1.next(10);
    await s2.next(20);
    u1(); u2();
    t.equal(n, 2, "factory called per subscriber");
    t.deepEqual(r1, [10]);
    t.deepEqual(r2, [20]);
});

test("Source.multicast: shared instance across concurrent subscribers", async (t) => {
    let n = 0;
    const s = new Subject();
    const multi = Source.multicast(() => { n++; return Source.fromSubject(s); });
    const r1 = [], r2 = [];
    const u1 = multi.connect((v) => r1.push(v));
    const u2 = multi.connect((v) => r2.push(v));
    await s.next(1);
    u1(); u2();
    t.equal(n, 1, "factory called once for both subscribers");
    t.deepEqual(r1, [1]);
    t.deepEqual(r2, [1]);
});

test("Source.pipe: transforms via subject", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = Source.pipe(Source.fromSubject(s), (subj, next) => {
        subj.map((x) => x * 3).connect(next);
    }).connect((v) => results.push(v));
    await s.next(2);
    await s.next(4);
    unsub();
    t.deepEqual(results, [6, 12]);
});
