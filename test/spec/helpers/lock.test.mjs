import { test } from "worker-testbed";
import { Lock, sleep } from "../../../build/index.mjs";

// The Lock is event-driven: releaseLock() emits on an internal `_tick` subject
// that wakes exactly the next queued acquirer (no fixed-delay polling). These
// tests target that robust behavior — fairness, prompt wake-up, mutual exclusion
// under contention, and absence of leaked wake-up subscribers.

// Number of live listeners parked on the lock's internal `_tick` subject.
const tickSubs = (lock) => {
    const events = lock._tick._emitter._events;
    let total = 0;
    for (const key of Reflect.ownKeys(events)) {
        total += events[key].length;
    }
    return total;
};

test("Lock: acquireLock resolves to undefined", async (t) => {
    const lock = new Lock();
    const r = await lock.acquireLock();
    await lock.releaseLock();
    if (r === undefined) t.pass();
    else t.fail(`expected undefined, got ${String(r)}`);
});

test("Lock: waiters wake in FIFO order", async (t) => {
    const lock = new Lock();
    await lock.acquireLock(); // hold the lock
    const order = [];
    const enqueue = (id) => lock.acquireLock().then(() => order.push(id));
    const p1 = enqueue(1);
    const p2 = enqueue(2);
    const p3 = enqueue(3);
    // release one at a time; each release wakes the next queued acquirer
    await lock.releaseLock(); await sleep(0);
    await lock.releaseLock(); await sleep(0);
    await lock.releaseLock();
    await Promise.all([p1, p2, p3]);
    await lock.releaseLock();
    if (order.join(",") === "1,2,3") t.pass();
    else t.fail(`expected 1,2,3, got ${order.join(",")}`);
});

test("Lock: contended acquire wakes promptly, not on a fixed delay", async (t) => {
    const lock = new Lock();
    await lock.acquireLock();
    const start = Date.now();
    const waited = lock.acquireLock().then(() => Date.now() - start);
    await sleep(5);
    await lock.releaseLock(); // event-driven wake-up
    const elapsed = await waited;
    await lock.releaseLock();
    // old polling impl waited up to 100ms; event-driven should be well under 50ms
    if (elapsed < 50) t.pass();
    else t.fail(`wake-up too slow: ${elapsed}ms`);
});

test("Lock: no _tick subscribers while idle", (t) => {
    const lock = new Lock();
    if (tickSubs(lock) === 0) t.pass();
    else t.fail(`expected 0 idle subscribers, got ${tickSubs(lock)}`);
});

test("Lock: parked acquirer subscribes then unsubscribes from _tick", async (t) => {
    const lock = new Lock();
    await lock.acquireLock();
    const p = lock.acquireLock(); // parks on _tick
    await sleep(0);
    const parked = tickSubs(lock);
    await lock.releaseLock();
    await p;
    await lock.releaseLock();
    if (parked >= 1 && tickSubs(lock) === 0) t.pass();
    else t.fail(`parked=${parked} afterDrain=${tickSubs(lock)}`);
});

test("Lock: mutual exclusion under 50 concurrent acquirers", async (t) => {
    const lock = new Lock();
    let current = 0;
    let max = 0;
    const task = async () => {
        await lock.acquireLock();
        try {
            current++;
            max = Math.max(max, current);
            await sleep(Math.floor(Math.random() * 3));
            current--;
        } finally {
            await lock.releaseLock();
        }
    };
    await Promise.all(Array.from({ length: 50 }, task));
    if (max === 1 && current === 0 && tickSubs(lock) === 0) t.pass();
    else t.fail(`max=${max} current=${current} tickSubs=${tickSubs(lock)}`);
});

test("Lock: sections do not interleave across real awaits", async (t) => {
    const lock = new Lock();
    const log = [];
    const work = async (id) => {
        await lock.acquireLock();
        try {
            log.push(`start:${id}`);
            await sleep(5);
            log.push(`end:${id}`);
        } finally {
            await lock.releaseLock();
        }
    };
    await Promise.all([work(1), work(2), work(3)]);
    const valid = log.every((entry, i) =>
        i % 2 === 0 ? entry.startsWith("start:") : entry.startsWith("end:")
    );
    // each start must be immediately followed by its own end
    const paired = log[0].endsWith(log[1].slice(-1))
        && log[2].endsWith(log[3].slice(-1))
        && log[4].endsWith(log[5].slice(-1));
    if (valid && paired) t.pass();
    else t.fail(`log=${log.join(",")}`);
});

test("Lock: releaseLock with no waiters does not leave a pending subscriber", async (t) => {
    const lock = new Lock();
    await lock.acquireLock();
    await lock.releaseLock(); // emits on _tick with nobody parked
    // a fresh uncontended acquire must still resolve immediately
    let acquired = false;
    await lock.acquireLock().then(() => { acquired = true; });
    await lock.releaseLock();
    if (acquired && tickSubs(lock) === 0) t.pass();
    else t.fail(`acquired=${acquired} tickSubs=${tickSubs(lock)}`);
});
