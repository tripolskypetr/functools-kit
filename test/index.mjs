import "./config/setup.mjs";
import { run } from 'worker-testbed';

import "./e2e/rx/subject-throw.test.mjs";
import "./e2e/rx/operator-throw.test.mjs";
import "./e2e/rx/operator-lib-throw.test.mjs";
import "./e2e/rx/source-throw.test.mjs";
import "./e2e/rx/toPromise-throw.test.mjs";

import "./e2e/hof/execpool.test.mjs";
import "./e2e/hof/pubsub.test.mjs";
import "./e2e/hof/waitForNext.test.mjs";

import "./spec/rx/EventEmitter.test.mjs";
import "./spec/rx/Observer.test.mjs";
import "./spec/rx/Subject.test.mjs";
import "./spec/rx/BehaviorSubject.test.mjs";
import "./spec/rx/Source.test.mjs";
import "./spec/rx/Operator.test.mjs";

import "./spec/hof/afterinit.test.mjs";
import "./spec/hof/awaiter.test.mjs";
import "./spec/hof/cached.test.mjs";
import "./spec/hof/cancelable.test.mjs";
import "./spec/hof/debounce.test.mjs";
import "./spec/hof/execpool.test.mjs";
import "./spec/hof/lock.test.mjs";
import "./spec/hof/memoize.test.mjs";
import "./spec/hof/obsolete.test.mjs";
import "./spec/hof/pubsub.test.mjs";
import "./spec/hof/queued.test.mjs";
import "./spec/hof/rate.test.mjs";
import "./spec/hof/retry.test.mjs";
import "./spec/hof/router.test.mjs";
import "./spec/hof/schedule.test.mjs";
import "./spec/hof/singlerun.test.mjs";
import "./spec/hof/singleshot.test.mjs";
import "./spec/hof/singletick.test.mjs";
import "./spec/hof/throttle.test.mjs";
import "./spec/hof/timeout.test.mjs";
import "./spec/hof/trycatch.test.mjs";
import "./spec/hof/ttl.test.mjs";
import "./spec/hof/waitForNext.test.mjs";

run(import.meta.url, () => {
    console.log("All tests are finished");
    process.exit(-1);
});
