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
export { ttl } from './utils/hof/ttl';

export { sleep } from './utils/sleep';
export { deepFlat } from './utils/deepFlat';

export { createAwaiter } from './utils/createAwaiter';

export { BehaviorSubject } from './utils/rx/BehaviorSubject';
export { EventEmitter } from './utils/rx/EventEmitter';
export { Observer } from './utils/rx/Observer';
export { Operator } from './utils/rx/Operator';
export { Subject } from './utils/rx/Subject';
export { Source } from './utils/rx/Source';

import TSubjectInternal from './model/TSubject';
import { IRowData, RowId } from './model/IRowData';
import TBehaviorSubjectInternal from './model/TBehaviorSubject';
import TObserverInternal, { TObservable as TObservableInternal } from './model/TObserver';

export type TSubject<Data = void> = TSubjectInternal<Data>;
export type TObserver<Data = void> = TObserverInternal<Data>;
export type TObservable<Data = void> = TObservableInternal<Data>;
export type TBehaviorSubject<Data = unknown> = TBehaviorSubjectInternal<Data>;

export type { IRowData, RowId };

export { paginateDocuments } from './api/paginateDocuments';
export { distinctDocuments } from './api/distinctDocuments';
export { resolveDocuments } from './api/resolveDocuments';
export { filterDocuments } from './api/filterDocuments';
export { pickDocuments } from './api/pickDocuments';
export { mapDocuments } from './api/mapDocuments';

export { iterateDocuments } from './api/iterateDocuments';
export { iteratePromise } from './api/iteratePromise';
export { iterateUnion } from './api/iterateUnion';
export { iterateList } from './api/iterateList';

export { compose } from './utils/compose';
