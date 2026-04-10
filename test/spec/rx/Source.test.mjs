import { test } from "worker-testbed";
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
    if (results.length === 1 && results[0] === 7) {
        t.pass();
    } else {
        t.fail(`expected [7], got ${JSON.stringify(results)}`);
    }
});

test("Source.fromValue: factory fn", async (t) => {
    const results = await collect(Source.fromValue(() => 99), 1);
    if (results.length === 1 && results[0] === 99) {
        t.pass();
    } else {
        t.fail(`expected [99], got ${JSON.stringify(results)}`);
    }
});

test("Source.fromArray: flat", async (t) => {
    const results = await collect(Source.fromArray([1, 2, 3]), 3);
    if (results[0] === 1 && results[1] === 2 && results[2] === 3) {
        t.pass();
    } else {
        t.fail(`expected [1,2,3], got ${JSON.stringify(results)}`);
    }
});

test("Source.fromArray: nested", async (t) => {
    const results = await collect(Source.fromArray([[1, [2]], 3]), 3);
    if (results[0] === 1 && results[1] === 2 && results[2] === 3) {
        t.pass();
    } else {
        t.fail(`expected [1,2,3], got ${JSON.stringify(results)}`);
    }
});

test("Source.fromPromise: resolves", async (t) => {
    const results = await collect(Source.fromPromise(async () => 42), 1);
    if (results.length === 1 && results[0] === 42) {
        t.pass();
    } else {
        t.fail(`expected [42], got ${JSON.stringify(results)}`);
    }
});

test("Source.fromDelay: fires after delay", async (t) => {
    const start = Date.now();
    await collect(Source.fromDelay(50), 1);
    if (Date.now() - start >= 45) {
        t.pass();
    } else {
        t.fail(`delay too short: ${Date.now() - start}ms`);
    }
});

test("Source.fromInterval: emits counter", async (t) => {
    const results = await collect(Source.fromInterval(20), 3);
    if (results[0] === 0 && results[1] === 1 && results[2] === 2) {
        t.pass();
    } else {
        t.fail(`expected [0,1,2], got ${JSON.stringify(results)}`);
    }
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
    if (cleaned) {
        t.pass();
    } else {
        t.fail("cleanup was not called");
    }
});

test("Source.createHot: factory called once at creation", (t) => {
    let calls = 0;
    Source.createHot((_next) => { calls++; });
    if (calls === 1) {
        t.pass();
    } else {
        t.fail(`expected 1 call, got ${calls}`);
    }
});

test("Source.merge: combines observers", async (t) => {
    const results = await collect(
        Source.merge([Source.fromValue(1), Source.fromValue(2), Source.fromValue(3)]), 3
    );
    const sorted = [...results].sort((a, b) => a - b);
    if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3) {
        t.pass();
    } else {
        t.fail(`expected [1,2,3], got ${JSON.stringify(results)}`);
    }
});

test("Source.join: emits tuple when all emitted", async (t) => {
    const results = await collect(
        Source.join([Source.fromValue("x"), Source.fromValue(1)]), 1
    );
    const ok = results.length === 1
        && results[0][0] === "x"
        && results[0][1] === 1;
    if (ok) {
        t.pass();
    } else {
        t.fail(`expected [["x",1]], got ${JSON.stringify(results)}`);
    }
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
    if (results.length >= 1) {
        t.pass();
    } else {
        t.fail("expected at least 1 emission");
    }
});

test("Source.fromSubject: forwards emissions", async (t) => {
    const s = new Subject();
    const results = [];
    const unsub = Source.fromSubject(s).connect((v) => results.push(v));
    await s.next(10);
    await s.next(20);
    unsub();
    if (results[0] === 10 && results[1] === 20 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [10,20], got ${JSON.stringify(results)}`);
    }
});

test("Source.fromBehaviorSubject: replays then forwards", async (t) => {
    const s = new BehaviorSubject(5);
    const results = [];
    const unsub = Source.fromBehaviorSubject(s).connect((v) => results.push(v));
    await s.next(6);
    unsub();
    if (results[0] === 5 && results[1] === 6 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [5,6], got ${JSON.stringify(results)}`);
    }
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
    if (n === 2 && r1[0] === 10 && r2[0] === 20) {
        t.pass();
    } else {
        t.fail(`n=${n} r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)}`);
    }
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
    if (n === 1 && r1[0] === 1 && r2[0] === 1) {
        t.pass();
    } else {
        t.fail(`n=${n} r1=${JSON.stringify(r1)} r2=${JSON.stringify(r2)}`);
    }
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
    if (results[0] === 6 && results[1] === 12 && results.length === 2) {
        t.pass();
    } else {
        t.fail(`expected [6,12], got ${JSON.stringify(results)}`);
    }
});
