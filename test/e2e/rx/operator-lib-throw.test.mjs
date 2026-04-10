import { test } from "worker-testbed";
import { Subject, sleep, Operator, createAwaiter } from "../../../build/index.mjs";

const noUnhandled = (t) => {
    process.on("unhandledRejection", (reason) => {
        t.fail("unhandled rejection: " + reason);
    });
};

const throws = async (t, fn, expectedMsg) => {
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === expectedMsg) {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
};

// ─── take ─────────────────────────────────────────────────────────────────────

test("throw: Operator.take → async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.take(5)).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(1), "1");
});

// ─── skip ─────────────────────────────────────────────────────────────────────

test("throw: Operator.skip → async throw propagates after skip", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.skip(1)).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await s.next(1); // skipped — no throw
    await throws(t, () => s.next(2), "2");
});

// ─── pair ─────────────────────────────────────────────────────────────────────

test("throw: Operator.pair → async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.pair()).connect(async (v) => { await sleep(5); throw new Error(String(v[0])); });
    await s.next(1); // first value — no pair yet
    await throws(t, () => s.next(2), "1");
});

// ─── group ────────────────────────────────────────────────────────────────────

test("throw: Operator.group → async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.group(2)).connect(async (v) => { await sleep(5); throw new Error(String(v[0])); });
    await s.next(10); // incomplete group — no emit
    await throws(t, () => s.next(20), "10");
});

// ─── distinct ─────────────────────────────────────────────────────────────────

test("throw: Operator.distinct → async throw propagates on distinct value", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.distinct()).connect(async (v) => { await sleep(5); throw new Error(String(v)); });
    await throws(t, () => s.next(5), "5");
});

test("throw: Operator.distinct → duplicate value does NOT throw", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.distinct()).connect(async () => { throw new Error("should-not-reach"); });
    await s.next(1).catch(() => {}); // first — emits and throws, ignore
    await s.next(1); // duplicate — filtered, no throw
    t.pass();
});

// ─── count ────────────────────────────────────────────────────────────────────

test("throw: Operator.count → async throw propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.count()).connect(async (v) => { await sleep(5); throw new Error(String(v.value)); });
    await throws(t, () => s.next(7), "7");
});

// ─── strideTricks ─────────────────────────────────────────────────────────────

test("throw: Operator.strideTricks → async throw in connect propagates", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.strideTricks(2, 2)).connect(async (v) => { await sleep(5); throw new Error("stride"); });
    await throws(t, () => s.next([1, 2, 3, 4]), "stride");
});

test("throw: Operator.strideTricks → throws on invalid stride size", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.strideTricks(10, 10)).connect(() => {});
    await throws(t, () => s.next([1, 2]), "rn-declarative strideTricks too big stride");
});

// ─── retry ────────────────────────────────────────────────────────────────────

test("throw: Operator.retry → throws after exhausting attempts", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    s.toObserver().operator(Operator.retry(2)).connect(async () => { await sleep(5); throw new Error("retry-fail"); });
    await throws(t, () => s.next(1), "retry-fail");
});

test("throw: Operator.retry → does NOT throw when succeeds within attempts", async (t) => {
    noUnhandled(t);
    const s = new Subject();
    let calls = 0;
    s.toObserver().operator(Operator.retry(3)).connect(() => {
        calls++;
        if (calls < 3) throw new Error("transient");
    });
    await s.next(1); // should succeed on 3rd attempt
    t.pass();
});
