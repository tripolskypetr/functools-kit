export { randomString } from './utils/randomString';
export { compareFulltext } from './utils/compareFulltext';

export { compareArray } from './utils/compareArray';
export { isObject } from './utils/isObject';

export { formatText } from './utils/formatText';

export { timeout, TIMEOUT_SYMBOL } from './utils/hof/timeout';
export { waitForNext } from './utils/hof/waitForNext';

export { getErrorMessage } from './utils/getErrorMessage';

export { singleshot, ISingleshotClearable } from './utils/hof/singleshot';
export { singlerun, Task, ISinglerunClearable } from './utils/hof/singlerun';
export { cancelable, CANCELED_PROMISE_SYMBOL, IWrappedCancelableFn } from './utils/hof/cancelable';
export { debounce, IDebounceClearable } from './utils/hof/debounce';
export { queued, IWrappedQueuedFn } from './utils/hof/queued';
export { execpool, IWrappedExecpoolFn } from './utils/hof/execpool';
export { retry, IWrappedRetryFn } from './utils/hof/retry';
export { cached, IClearableCached } from './utils/hof/cached';
export { memoize, IClearableMemoize, IControlMemoize, IRefMemoize } from './utils/hof/memoize';
export { trycatch, IControllTrycatch, IErrorTrycatch, CATCH_SYMBOL } from './utils/hof/trycatch';
export { ttl, IClearableTtl } from './utils/hof/ttl';
export { throttle, IClearableThrottle } from './utils/hof/throttle';

export { pubsub } from './utils/hof/pubsub';

export { obsolete } from './utils/hof/obsolete';
export { singletick, IClearableSingletick } from './utils/hof/singletick';
export { afterinit, IWrappedAfterInitFn } from './utils/hof/afterinit';
export { lock, IWrappedLockFn } from './utils/hof/lock';

export { sleep } from './utils/sleep';
export { deepFlat } from './utils/deepFlat';

export { createAwaiter, IAwaiter } from './utils/createAwaiter';

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

import TOffsetPaginatorInternal from './model/TOffsetPaginator';
import TCursorPaginatorInternal from './model/TCursorPaginator';
import TBasePaginatorInternal from './model/TBasePaginator';
import TPaginatorInternal from './model/TPaginator';

export type TOffsetPaginator<
    FilterData extends {} = any,
    RowData extends IRowData = any,
    Payload = any
> = TOffsetPaginatorInternal<FilterData, RowData, Payload>;

export type TCursorPaginator<
    FilterData extends {} = any,
    RowData extends IRowData = any,
    Payload = any
> = TCursorPaginatorInternal<FilterData, RowData, Payload>;

export type TPaginator<
    FilterData extends {} = any,
    RowData extends IRowData = any,
    Payload = any
> = TPaginatorInternal<FilterData, RowData, Payload>;

export type TBasePaginator<
  FilterData extends {} = any,
  RowData extends IRowData = any,
> = TBasePaginatorInternal<FilterData, RowData>;

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

export { has } from './utils/math/has';
export { and } from './utils/math/and';
export { or } from './utils/math/or';
export { not } from './utils/math/not';
export { match } from './utils/math/match';

export { first } from './utils/math/first';
export { join } from './utils/math/join';
export { last } from './utils/math/last';
export { truely } from './utils/math/truely';

export { compose } from './utils/compose';
export { errorData } from './utils/errorData';

export { fetchApi, FetchError } from './api/fetchApi';

export type { TRequest } from './model/TRequest';
export type { TResponse } from './model/TResponse';
