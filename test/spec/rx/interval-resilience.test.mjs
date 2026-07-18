import { test } from "worker-testbed";
import { Source, sleep } from "../../../build/index.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

const noUnhandled = (t) => process.on("unhandledRejection", (r) => t.fail("unhandled: " + r));

// white-box: counts ERROR_EVENT listeners on an observer's internal broadcast
const countErrorListeners = (observer) => {
    const events = observer.broadcast._events;
    const key = Reflect.ownKeys(events).find(
        (k) => typeof k === "symbol" && k.description === "observer-error",
    );
    return key ? events[key].length : 0;
};

// ═══════════════════════════════════════════════════════════════════════════════
// fromInterval: a throwing subscriber must not kill the interval
// ═══════════════════════════════════════════════════════════════════════════════

test("fromInterval: keeps ticking after a subscriber throws", async (t) => {
    noUnhandled(t);
    const values = [];
    const errors = [];
    const mapped = Source.fromInterval(10)
        .map((i) => {
            if (i === 0) throw new Error("tick-0");
            return i;
        });
    const un = mapped.connect((i) => values.push(i));
    const unErr = mapped.onError((e) => errors.push(e));
    await sleep(100);
    un();
    unErr();
    if (!errors.some((e) => e instanceof Error && e.message === "tick-0")) {
        t.fail(`error not forwarded downstream: ${JSON.stringify(errors.map(String))}`);
        return;
    }
    if (values.includes(1) && values.includes(2)) t.pass();
    else t.fail(`interval died after throw, later ticks missing: ${JSON.stringify(values)}`);
});

test("fromInterval: throwing consumer rejects toPromise but the shared clock survives", async (t) => {
    noUnhandled(t);
    const clock = Source.fromInterval(10).share();
    const unBad = clock.connect((i) => {
        throw new Error("bad-consumer-" + i);
    });
    let rejected = false;
    try {
        await clock.map((x) => x).toPromise();
    } catch (e) {
        rejected = true;
    }
    if (!rejected) {
        t.fail("toPromise should have rejected while the bad consumer was attached");
        return;
    }
    unBad();
    const v = await clock.map((x) => x).toPromise();
    clock.unsubscribe();
    if (typeof v === "number") t.pass();
    else t.fail(`expected a tick number after recovery, got ${v}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromInterval: dispose while an emit is pending must not re-arm the timer
// ═══════════════════════════════════════════════════════════════════════════════

test("fromInterval: dispose during pending emit does not resurrect the timer", async (t) => {
    noUnhandled(t);
    const source = Source.fromInterval(20);
    const un = source.connect(async () => {
        await sleep(50);
    });
    await sleep(10);
    un(); // dispose arrives while process() awaits observer.emit
    await sleep(60); // pending emit settles; a buggy impl re-arms setTimeout here
    let leaked = 0;
    source.connect(() => {
        leaked++;
    });
    await sleep(100);
    if (leaked === 0) t.pass();
    else t.fail(`zombie interval emitted ${leaked} ticks after dispose`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Observer.unsubscribe(): errorForwarder cleanup on the parent
// ═══════════════════════════════════════════════════════════════════════════════

test("Observer.unsubscribe(): removes errorForwarder from parent", async (t) => {
    const parent = Source.fromInterval(10_000);
    const child = parent.map((x) => x);
    if (countErrorListeners(parent) !== 1) {
        t.fail(`precondition failed: expected 1 error listener, got ${countErrorListeners(parent)}`);
        return;
    }
    child.unsubscribe();
    if (countErrorListeners(parent) === 0) t.pass();
    else t.fail("errorForwarder leaked on parent after child.unsubscribe()");
});

test("Observer.unsubscribe(): sibling keeps its own errorForwarder", async (t) => {
    const parent = Source.fromInterval(10_000);
    const childA = parent.map((x) => x);
    parent.map((x) => x); // childB stays subscribed
    if (countErrorListeners(parent) !== 2) {
        t.fail(`precondition failed: expected 2 error listeners, got ${countErrorListeners(parent)}`);
        return;
    }
    childA.unsubscribe();
    const left = countErrorListeners(parent);
    if (left === 1) t.pass();
    else t.fail(`expected 1 error listener after unsubscribing childA, got ${left}`);
});

test("Observer: connect-unsubscribe path still removes errorForwarder", async (t) => {
    const parent = Source.fromInterval(10_000);
    const child = parent.map((x) => x);
    const un = child.connect(() => {});
    un();
    if (countErrorListeners(parent) === 0) t.pass();
    else t.fail("errorForwarder leaked after connect-unsubscribe");
});
