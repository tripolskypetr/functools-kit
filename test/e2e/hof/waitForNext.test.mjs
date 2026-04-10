import { test } from "worker-testbed";
import { waitForNext, Subject, TIMEOUT_SYMBOL } from "../../../build/index.mjs";

test("throw: waitForNext → timeout resolves with TIMEOUT_SYMBOL, no throw", async (t) => {
    const s = new Subject();
    const result = await waitForNext(s, () => false, 20);
    if (result === TIMEOUT_SYMBOL) {
        t.pass();
    } else {
        t.fail(`expected TIMEOUT_SYMBOL, got ${String(result)}`);
    }
});
