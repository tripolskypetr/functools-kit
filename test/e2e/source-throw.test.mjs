import { test } from "worker-testbed";
import { sleep, Source, createAwaiter } from "../../build/index.mjs";

const throwsVia = async (t, promise, expectedMsg) => {
    try {
        await promise;
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === expectedMsg) {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
};

// ─── fromArray ────────────────────────────────────────────────────────────────

test("throw: Source.fromArray → async throw in connect propagates", async (t) => {
    const [promise, awaiter] = createAwaiter();
    Source.fromArray([42]).connect(async (v) => {
        await sleep(5);
        awaiter.reject(new Error("fromArray-" + v));
    });
    await throwsVia(t, promise, "fromArray-42");
});

// ─── fromPromise ──────────────────────────────────────────────────────────────

test("throw: Source.fromPromise → async throw in connect propagates", async (t) => {
    const [promise, awaiter] = createAwaiter();
    Source.fromPromise(async () => { await sleep(10); return 42; })
        .connect(async (v) => {
            await sleep(5);
            awaiter.reject(new Error("fromPromise-" + v));
        });
    await throwsVia(t, promise, "fromPromise-42");
});

// ─── fromDelay ────────────────────────────────────────────────────────────────

test("throw: Source.fromDelay → async throw in connect propagates", async (t) => {
    const [promise, awaiter] = createAwaiter();
    Source.fromDelay(30).connect(async () => {
        await sleep(5);
        awaiter.reject(new Error("fromDelay-throw"));
    });
    await throwsVia(t, promise, "fromDelay-throw");
});

// ─── fromInterval ─────────────────────────────────────────────────────────────

test("throw: Source.fromInterval → async throw in connect propagates", async (t) => {
    const [promise, awaiter] = createAwaiter();
    let done = false;
    const unsub = Source.fromInterval(20).connect(async (v) => {
        if (v === 0 && !done) {
            done = true;
            await sleep(5);
            awaiter.reject(new Error("fromInterval-" + v));
        }
    });
    await throwsVia(t, promise, "fromInterval-0");
});
