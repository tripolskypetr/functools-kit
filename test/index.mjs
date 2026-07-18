import "./config/setup.mjs";
import { run } from 'worker-testbed';


import "./spec/math/math.test.mjs";
import "./spec/math/math-audit.test.mjs";
import "./spec/utils/utils.test.mjs";
import "./spec/helpers/helpers.test.mjs";
import "./spec/helpers/lock.test.mjs";
import "./spec/api/api.test.mjs";
import "./spec/api/api-audit.test.mjs";
import "./spec/bugs/found-bugs.test.mjs";

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
import "./spec/rx/ObserverOnceToPromise.test.mjs";
import "./spec/rx/subscriptions.test.mjs";
import "./spec/rx/integration-chains.test.mjs";
import "./spec/rx/integration-chain-throws-scoped.test.mjs";

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
import "./spec/hof/hof-audit.test.mjs";

import "./spec/rx/integration-chain-throws.test.mjs";
import "./spec/rx/fromDelay-fromInterval-throws.test.mjs";
import "./spec/rx/from-chain-throws.test.mjs";
import "./spec/rx/error-propagation-extra.test.mjs";
import "./spec/rx/toIteratorContext.test.mjs";
import "./spec/rx/interval-resilience.test.mjs";
import "./spec/rx/dead-chains.test.mjs";
import "./spec/rx/subscription-hygiene.test.mjs";
import "./spec/rx/deep-audit.test.mjs";
import "./spec/rx/leak-matrix.test.mjs";
import "./spec/rx/chaos-and-limits.test.mjs";
import "./spec/rx/second-pass-audit.test.mjs";

run(import.meta.url, () => {
    console.log("All tests are finished");
    process.exit(-1);
});
