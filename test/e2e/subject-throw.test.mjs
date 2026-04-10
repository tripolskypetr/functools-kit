import { test } from "worker-testbed";
import { Subject, sleep } from "../../build/index.mjs";

test("Subject: exception from async subscriber propagates to next()", async (t) => {
    const subject = new Subject();
    subject.filter(v => v === 1).connect(async (value) => { await sleep(10); throw new Error(String(value)); });
    process.on("unhandledRejection", (reason) => {
        t.fail("unhandled rejection: " + reason);
    });
    try {
        await subject.next(1);
        t.fail("should have thrown");
    } catch (e) {
        if (e instanceof Error && e.message === "1") {
            t.pass();
        } else {
            t.fail(`unexpected error: ${e}`);
        }
    }
});
