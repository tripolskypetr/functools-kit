import { test } from "worker-testbed";
import { Subject, Source, Operator, sleep } from "../../../build/index.mjs";

test("toIteratorContext: collects all values without dropping any", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    for (const v of [1, 2, 3, 4, 5]) await s.next(v);
    done();
    await consumer;
    if (results.join(',') === '1,2,3,4,5') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: rapid burst — no elements dropped", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    // fire all without awaiting — stress test the buffer
    const nexts = [10, 20, 30, 40, 50].map(v => s.next(v));
    await Promise.all(nexts);
    done();
    await consumer;
    if (results.length === 5 && results.join(',') === '10,20,30,40,50') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: slow consumer — buffer holds elements", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            await sleep(10); // slow consumer
            results.push(v);
        }
    })();
    for (const v of [1, 2, 3]) await s.next(v);
    done();
    await consumer;
    if (results.join(',') === '1,2,3') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: works with map chain", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.map(v => v * 2).toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    for (const v of [1, 2, 3]) await s.next(v);
    done();
    await consumer;
    if (results.join(',') === '2,4,6') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: done() stops iteration cleanly", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
        }
    })();
    await s.next(1);
    await s.next(2);
    done();
    await consumer;
    if (results.length >= 2) t.pass();
    else t.fail(`got only ${results.length} elements`);
});

test("toIteratorContext: fromArray — no elements dropped", async (t) => {
    const { iterate, done } = Source.fromArray([10, 20, 30, 40]).toIteratorContext();
    const results = [];
    for await (const v of iterate()) {
        results.push(v);
        if (results.length === 4) done();
    }
    if (results.join(',') === '10,20,30,40') t.pass();
    else t.fail(`got ${results}`);
});

test("toIteratorContext: operator(take) — stops after N elements, none dropped", async (t) => {
    const s = new Subject();
    const { iterate, done } = s.operator(Operator.take(3)).toIteratorContext();
    const results = [];
    const consumer = (async () => {
        for await (const v of iterate()) {
            results.push(v);
            if (results.length === 3) done();
        }
    })();
    for (const v of [1, 2, 3, 4, 5]) await s.next(v);
    await consumer;
    if (results.join(',') === '1,2,3') t.pass();
    else t.fail(`got ${results}`);
});
