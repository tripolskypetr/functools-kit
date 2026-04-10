import "./config/setup.mjs";
import { run } from 'worker-testbed';

import "./e2e/subject-throw.test.mjs";
import "./e2e/operator-throw.test.mjs";

import "./spec/awaiter.test.mjs";
import "./spec/rx/EventEmitter.test.mjs";
import "./spec/rx/Observer.test.mjs";
import "./spec/rx/Subject.test.mjs";
import "./spec/rx/BehaviorSubject.test.mjs";
import "./spec/rx/Source.test.mjs";
import "./spec/rx/Operator.test.mjs";

run(import.meta.url, () => {
    console.log("All tests are finished");
    process.exit(-1);
});
