import { test } from "worker-testbed";
import { Source, sleep } from "../../../build/index.mjs";

// ─── helpers ──────────────────────────────────────────────────────────────────

const noUnhandled = (t) => process.on("unhandledRejection", (r) => t.fail("unhandled: " + r));

// ═══════════════════════════════════════════════════════════════════════════════
// fromDelay
// ═══════════════════════════════════════════════════════════════════════════════

test("fromDelay: map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromDelay(10)
            .map(() => { throw new Error("delay-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delay-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromDelay: tap throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromDelay(10)
            .tap(() => { throw new Error("delay-tap-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delay-tap-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromDelay: mapAsync throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromDelay(10)
            .mapAsync(async () => { await sleep(5); throw new Error("delay-mapAsync-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delay-mapAsync-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromDelay: filter → map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromDelay(10)
            .filter(() => true)
            .map(() => { throw new Error("delay-chain-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delay-chain-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromDelay: tap → map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromDelay(10)
            .tap(() => {})
            .map(() => { throw new Error("delay-tap-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "delay-tap-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromDelay: no throw — toPromise resolves normally", async (t) => {
    const v = await Source.fromDelay(10).toPromise();
    if (v === undefined) t.pass();
    else t.fail(`expected undefined, got ${v}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// fromInterval
// ═══════════════════════════════════════════════════════════════════════════════

test("fromInterval: map throws on first tick → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromInterval(10)
            .map(() => { throw new Error("interval-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromInterval: tap throws on first tick → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromInterval(10)
            .tap(() => { throw new Error("interval-tap-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-tap-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromInterval: mapAsync throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromInterval(10)
            .mapAsync(async () => { await sleep(5); throw new Error("interval-mapAsync-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-mapAsync-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromInterval: filter → map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromInterval(10)
            .filter(() => true)
            .map(() => { throw new Error("interval-chain-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-chain-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromInterval: map throws on second tick (first passes) → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromInterval(10)
            .filter(i => i >= 1)
            .map(() => { throw new Error("interval-second-tick-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-second-tick-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});

test("fromInterval: no throw — toPromise resolves on first tick", async (t) => {
    const v = await Source.fromInterval(10).toPromise();
    if (v === 0) t.pass();
    else t.fail(`expected 0, got ${v}`);
});

test("fromInterval: tap → map throws → toPromise rejects", async (t) => {
    noUnhandled(t);
    try {
        await Source.fromInterval(10)
            .tap(() => {})
            .map(() => { throw new Error("interval-tap-map-error"); })
            .toPromise();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "interval-tap-map-error") t.pass();
        else t.fail(`unexpected: ${e}`);
    }
});
