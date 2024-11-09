export { randomString } from './utils/randomString';
export { compareFulltext } from './utils/compareFulltext';

export { compareArray } from './utils/compareArray';
export { isObject } from './utils/isObject';

export { formatText } from './utils/formatText';

export { singleshot } from './utils/hof/singleshot';
export { singlerun, Task } from './utils/hof/singlerun';
export { cancelable, CANCELED_SYMBOL as CANCELED_PROMISE_SYMBOL } from './utils/hof/cancelable';
export { debounce } from './utils/hof/debounce';
export { queued } from './utils/hof/queued';
export { execpool } from './utils/hof/execpool';
export { retry } from './utils/hof/retry';
export { cached } from './utils/hof/cached';
export { memoize } from './utils/hof/memoize';
export { trycatch } from './utils/hof/trycatch';

export { sleep } from './utils/sleep';
export { deepFlat } from './utils/deepFlat';

export { createAwaiter } from './utils/createAwaiter';

export { BehaviorSubject } from './utils/rx/BehaviorSubject';
export { EventEmitter } from './utils/rx/EventEmitter';
export { Observer } from './utils/rx/Observer';
export { Operator } from './utils/rx/Operator';
export { Subject } from './utils/rx/Subject';
export { Source } from './utils/rx/Source';

import type TSubjectInternal from './model/TSubject';
import TBehaviorSubjectInternal from './model/TBehaviorSubject';
import TObserverInternal, { TObservable as TObservableInternal } from './model/TObserver';

export type TSubject<Data = void> = TSubjectInternal<Data>;
export type TObserver<Data = void> = TObserverInternal<Data>;
export type TObservable<Data = void> = TObservableInternal<Data>;
export type TBehaviorSubject<Data = unknown> = TBehaviorSubjectInternal<Data>;

export { compose } from './utils/compose';
