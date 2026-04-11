import { test } from "worker-testbed";
import { Source, sleep } from "../../../build/index.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

const noUnhandled = (t) => process.on("unhandledRejection", (r) => t.fail("unhandled: " + r));

const throws = async (t, fn, expectedMsg) => {
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === expectedMsg) t.pass();
        else t.fail(`unexpected: ${e}`);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// fromPromise().map().toPromise()
// ═══════════════════════════════════════════════════════════════════════════════

test("fromPromise().map().toPromise() — resolves mapped value", async (t) => {
    const v = await Source.fromPromise(async () => 10)
        .map(x => x * 2)
        .toPromise();
    if (v === 20) t.pass();
    else t.fail(`expected 20, got ${v}`);
});

test("fromPromise().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => 10)
            .map(() => { throw new Error("fromPromise-map-error"); })
            .toPromise(),
        "fromPromise-map-error"
    );
});

test("fromPromise().map().toPromise() — promise rejection propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => { throw new Error("fromPromise-reject-error"); })
            .map(x => x)
            .toPromise(),
        "fromPromise-reject-error"
    );
});

test("fromPromise().tap().map().toPromise() — throw in tap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => 5)
            .tap(() => { throw new Error("fromPromise-tap-error"); })
            .map(x => x)
            .toPromise(),
        "fromPromise-tap-error"
    );
});

test("fromPromise().filter().map().toPromise() — throw in chained map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => 5)
            .filter(x => x > 0)
            .map(() => { throw new Error("fromPromise-filter-map-error"); })
            .toPromise(),
        "fromPromise-filter-map-error"
    );
});

test("fromPromise().mapAsync().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromPromise(async () => 5)
            .mapAsync(async () => { await sleep(5); throw new Error("fromPromise-mapAsync-error"); })
            .toPromise(),
        "fromPromise-mapAsync-error"
    );
});

test("fromPromise() with fallbackfn — error goes to fallback, not toPromise", async (t) => {
    noUnhandled(t);
    let caught = null;
    const p = Source.fromPromise(
        async () => { throw new Error("fallback-error"); },
        (e) => { caught = e.message; }
    ).map(x => x).toPromise();
    // promise never resolves — just verify fallback was called
    await sleep(30);
    if (caught === "fallback-error") t.pass();
    else t.fail(`expected fallback called, got: ${caught}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromArray().map().toPromise()
// ═══════════════════════════════════════════════════════════════════════════════

test("fromArray().map().toPromise() — resolves first mapped value", async (t) => {
    const v = await Source.fromArray([1, 2, 3])
        .map(x => x * 10)
        .toPromise();
    if (v === 10) t.pass();
    else t.fail(`expected 10, got ${v}`);
});

test("fromArray().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .map(() => { throw new Error("fromArray-map-error"); })
            .toPromise(),
        "fromArray-map-error"
    );
});

test("fromArray().tap().map().toPromise() — throw in tap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .tap(() => { throw new Error("fromArray-tap-error"); })
            .map(x => x)
            .toPromise(),
        "fromArray-tap-error"
    );
});

test("fromArray().filter().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([0, 1, 2])
            .filter(x => x > 0)
            .map(() => { throw new Error("fromArray-filter-map-error"); })
            .toPromise(),
        "fromArray-filter-map-error"
    );
});

test("fromArray().mapAsync().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromArray([1, 2, 3])
            .mapAsync(async () => { await sleep(5); throw new Error("fromArray-mapAsync-error"); })
            .toPromise(),
        "fromArray-mapAsync-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromValue().map().toPromise()
// ═══════════════════════════════════════════════════════════════════════════════

test("fromValue().map().toPromise() — resolves mapped value", async (t) => {
    const v = await Source.fromValue(7)
        .map(x => x * 3)
        .toPromise();
    if (v === 21) t.pass();
    else t.fail(`expected 21, got ${v}`);
});

test("fromValue().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromValue(7)
            .map(() => { throw new Error("fromValue-map-error"); })
            .toPromise(),
        "fromValue-map-error"
    );
});

test("fromValue().tap().map().toPromise() — throw in tap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromValue(7)
            .tap(() => { throw new Error("fromValue-tap-error"); })
            .map(x => x)
            .toPromise(),
        "fromValue-tap-error"
    );
});

test("fromValue().filter().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromValue(7)
            .filter(x => x > 0)
            .map(() => { throw new Error("fromValue-filter-map-error"); })
            .toPromise(),
        "fromValue-filter-map-error"
    );
});

test("fromValue().mapAsync().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromValue(7)
            .mapAsync(async () => { await sleep(5); throw new Error("fromValue-mapAsync-error"); })
            .toPromise(),
        "fromValue-mapAsync-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromDelay().map().toPromise()
// ═══════════════════════════════════════════════════════════════════════════════

test("fromDelay().map().toPromise() — resolves mapped value", async (t) => {
    const v = await Source.fromDelay(10)
        .map(() => 42)
        .toPromise();
    if (v === 42) t.pass();
    else t.fail(`expected 42, got ${v}`);
});

test("fromDelay().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromDelay(10)
            .map(() => { throw new Error("fromDelay-map-error"); })
            .toPromise(),
        "fromDelay-map-error"
    );
});

test("fromDelay().tap().map().toPromise() — throw in tap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromDelay(10)
            .tap(() => { throw new Error("fromDelay-tap-error"); })
            .map(() => 1)
            .toPromise(),
        "fromDelay-tap-error"
    );
});

test("fromDelay().mapAsync().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromDelay(10)
            .mapAsync(async () => { await sleep(5); throw new Error("fromDelay-mapAsync-error"); })
            .toPromise(),
        "fromDelay-mapAsync-error"
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromInterval().map().toPromise()
// ═══════════════════════════════════════════════════════════════════════════════

test("fromInterval().map().toPromise() — resolves first mapped value", async (t) => {
    const v = await Source.fromInterval(10)
        .map(i => i + 100)
        .toPromise();
    if (v === 100) t.pass();
    else t.fail(`expected 100, got ${v}`);
});

test("fromInterval().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromInterval(10)
            .map(() => { throw new Error("fromInterval-map-error"); })
            .toPromise(),
        "fromInterval-map-error"
    );
});

test("fromInterval().tap().map().toPromise() — throw in tap propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromInterval(10)
            .tap(() => { throw new Error("fromInterval-tap-error"); })
            .map(x => x)
            .toPromise(),
        "fromInterval-tap-error"
    );
});

test("fromInterval().filter().map().toPromise() — throw in map propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromInterval(10)
            .filter(i => i >= 0)
            .map(() => { throw new Error("fromInterval-filter-map-error"); })
            .toPromise(),
        "fromInterval-filter-map-error"
    );
});

test("fromInterval().mapAsync().toPromise() — throw in mapAsync propagates", async (t) => {
    noUnhandled(t);
    await throws(t, () =>
        Source.fromInterval(10)
            .mapAsync(async () => { await sleep(5); throw new Error("fromInterval-mapAsync-error"); })
            .toPromise(),
        "fromInterval-mapAsync-error"
    );
});
