import { test } from "worker-testbed";
import { obsolete } from "../../../build/index.mjs";

test("obsolete: throws when no prompt available", async (t) => {
    const fn = obsolete(async () => 42, "testMethod");
    try {
        await fn();
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message.includes("obsolete")) {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});

test("obsolete: wraps async function signature", (t) => {
    const fn = obsolete(async (x) => x, "fn");
    if (typeof fn === "function") {
        t.pass();
    } else {
        t.fail("expected a function");
    }
});
