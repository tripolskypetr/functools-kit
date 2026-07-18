import { test } from "worker-testbed";
import { Source, Operator, Subject, sleep } from "../../../build/index.mjs";

// matrix leak invariant: for every source × operator × consumer combination,
// a full consume-then-teardown cycle must leave ZERO listeners on both the
// source node and the leaf node (white-box over broadcast._events).

const totalListeners = (observer) => {
    const events = observer.broadcast._events;
    return Reflect.ownKeys(events).reduce((n, k) => n + events[k].length, 0);
};

const SOURCES = {
    fromValue: () => ({ obs: Source.fromValue(1) }),
    fromArray: () => ({ obs: Source.fromArray([1, 2, 3]) }),
    fromInterval: () => ({ obs: Source.fromInterval(10) }),
    fromDelay: () => ({ obs: Source.fromDelay(10) }),
    fromPromise: () => ({ obs: Source.fromPromise(async () => { await sleep(5); return 1; }) }),
    createCold: () => {
        let timer;
        return {
            obs: Source.createCold((next) => {
                timer = setInterval(() => next(1), 10);
                return () => clearInterval(timer);
            }),
        };
    },
    fromSubject: () => {
        const subject = new Subject();
        const timer = setInterval(() => subject.next(1), 10);
        return {
            obs: Source.fromSubject(subject),
            cleanup: () => clearInterval(timer),
            verify: () => subject.hasListeners === false ? null : "subject still has listeners",
        };
    },
};

const OPERATORS = {
    map: (o) => o.map((x) => x),
    filter: (o) => o.filter(() => true),
    tap: (o) => o.tap(() => {}),
    reduce: (o) => o.reduce((_, c) => c, 0),
    flatMap: (o) => o.flatMap((v) => [v]),
    split: (o) => o.split(),
    mapAsync: (o) => o.mapAsync(async (v) => v),
    debounce: (o) => o.debounce(5),
    delay: (o) => o.delay(5),
    repeat: (o) => o.repeat(50),
    take: (o) => o.operator(Operator.take(1)),
    distinct: (o) => o.operator(Operator.distinct()),
    merge: (o) => o.merge(new Subject().toObserver()),
};

const CONSUMERS = {
    connect: async (leaf) => {
        const un = leaf.connect(() => {});
        await sleep(30);
        un();
        return null;
    },
    toPromise: async (leaf) => {
        const r = await Promise.race([
            leaf.toPromise().then(() => "ok", () => "ok"),
            sleep(200).then(() => "timeout"),
        ]);
        if (r === "timeout") {
            leaf.unsubscribe();
            return "toPromise never settled";
        }
        return null;
    },
    once: async (leaf) => {
        const off = leaf.once(() => {});
        await sleep(30);
        off();
        return null;
    },
    iterator: async (leaf) => {
        const ctx = leaf.toIteratorContext();
        const it = ctx.iterate();
        await Promise.race([it.next(), sleep(30)]);
        ctx.done();
        return null;
    },
};

const runMatrix = async (consumerName) => {
    const consume = CONSUMERS[consumerName];
    const failures = [];
    for (const [srcName, makeSource] of Object.entries(SOURCES)) {
        for (const [opName, applyOp] of Object.entries(OPERATORS)) {
            const combo = `${srcName} → ${opName} → ${consumerName}`;
            const { obs: source, cleanup, verify } = makeSource();
            const leaf = applyOp(source);
            const consumeError = await consume(leaf);
            await sleep(10);
            cleanup && cleanup();
            if (consumeError) {
                failures.push(`${combo}: ${consumeError}`);
                continue;
            }
            const srcLeft = totalListeners(source);
            const leafLeft = totalListeners(leaf);
            if (srcLeft !== 0 || leafLeft !== 0) {
                failures.push(`${combo}: source=${srcLeft} leaf=${leafLeft} listeners left`);
            }
            const extra = verify && verify();
            if (extra) failures.push(`${combo}: ${extra}`);
        }
    }
    return failures;
};

test("leak matrix: connect consumer leaves zero listeners everywhere", async (t) => {
    const failures = await runMatrix("connect");
    if (failures.length === 0) t.pass();
    else t.fail(failures.join(" | "));
});

test("leak matrix: toPromise consumer leaves zero listeners everywhere", async (t) => {
    const failures = await runMatrix("toPromise");
    if (failures.length === 0) t.pass();
    else t.fail(failures.join(" | "));
});

test("leak matrix: once consumer leaves zero listeners everywhere", async (t) => {
    const failures = await runMatrix("once");
    if (failures.length === 0) t.pass();
    else t.fail(failures.join(" | "));
});

test("leak matrix: iterator consumer leaves zero listeners everywhere", async (t) => {
    const failures = await runMatrix("iterator");
    if (failures.length === 0) t.pass();
    else t.fail(failures.join(" | "));
});
