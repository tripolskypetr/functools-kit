import EventEmitter from "./EventEmitter";

import type TObserver from "../../model/TObserver";

import compose from '../compose';
import sleep from "../sleep";

import queued from "../hof/queued";

import { CANCELED_PROMISE_SYMBOL } from "../hof/cancelable";
import singlerun from "../hof/singlerun";
import createAwaiter from "../createAwaiter";

const OBSERVER_EVENT = Symbol('observer-subscribe');
const ERROR_EVENT = Symbol('observer-error');

const CONNECT_EVENT = Symbol('observer-connect');
const DISCONNECT_EVENT = Symbol('observer-disconnect');

export const LISTEN_CONNECT = Symbol('observer-connect-listen');
export const LISTEN_DISCONNECT = Symbol('observer-disconnect-listen');

declare var setTimeout: any;
declare var clearTimeout: any;

type Fn = (...args: any[]) => void;

/**
 * A class representing an Observer.
 *
 * @template Data - The type of data to observe.
 */
export class Observer<Data = any> implements TObserver<Data> {

    private readonly broadcast = new EventEmitter();
    private _isShared = false;
    private _isDisposed = false;

    /**
     * Returns the current value of the 'isShared' property.
     *
     * @returns - The value of the 'isShared' property.
     */
    public get isShared() {
        return this._isShared;
    };

    /**
     * Returns whether the given event has any listeners.
     *
     * @returns True if there are listeners for the event, otherwise false.
     */
    public get hasListeners() {
        return !!this.broadcast.getListeners(OBSERVER_EVENT).length;
    };

    constructor(private readonly dispose: Fn) { }

    /**
     * Emits an error downstream through the error channel.
     * Sources use this to propagate async process errors through the chain.
     */
    public emitError = (error: unknown) => {
        this.broadcast.emit(ERROR_EVENT, error).catch(() => undefined);
    };

    /**
     * Subscribes to upstream errors forwarded via ERROR_EVENT.
     */
    public onError = (fn: (error: unknown) => void) => {
        this.broadcast.subscribe(ERROR_EVENT, fn);
        return () => this.broadcast.unsubscribe(ERROR_EVENT, fn);
    };

    /**
     * Sets up a listener for the connect event on the broadcast channel.
     *
     * @param fn - The callback function to be executed once the connect event is triggered.
     */
    [LISTEN_CONNECT](fn: () => void) {
        this.broadcast.once(CONNECT_EVENT, fn);
    };

    /**
     * Adds a listener for the DISCONNECT_EVENT.
     *
     * @param fn - The function to be executed when the event occurs.
     */
    [LISTEN_DISCONNECT](fn: () => void) {
        this.broadcast.once(DISCONNECT_EVENT, fn);
    };

    /**
     * Subscribe a given observer to the global broadcast event.
     *
     * @param observer - The observer subscribing to the event.
     * @param callback - The callback function to be executed when the event is triggered.
     */
    private _subscribe = <T = any>(observer: TObserver<T>, callback: Fn) => {
        this.broadcast.subscribe(OBSERVER_EVENT, callback);
        const errorForwarder = (error: unknown) => (observer as Observer<T>).emitError(error);
        this.broadcast.subscribe(ERROR_EVENT, errorForwarder);
        observer[LISTEN_CONNECT](() => {
            this.broadcast.emit(CONNECT_EVENT);
        });
        observer[LISTEN_DISCONNECT](() => {
            this.broadcast.unsubscribe(ERROR_EVENT, errorForwarder);
            // a shared parent stays alive when its last child leaves —
            // cascading DISCONNECT here would sever the upstream error
            // forwarder of a live node
            if (!this.hasListeners && !this._isShared) {
                this.broadcast.emit(DISCONNECT_EVENT).catch(() => undefined);
            }
        });
    };

    /**
     * Unsubscribes a callback function from the observer event.
     *
     * @param callback - The callback function to unsubscribe.
     */
    private _unsubscribe = (callback: Fn) => {
        this.broadcast.unsubscribe(OBSERVER_EVENT, callback);
    };

    /**
     * Tries to dispose the object if it has no listeners and is not shared.
     * If disposed successfully, emits the DISCONNECT_EVENT.
     */
    private tryDispose = () => {
        if (!this.hasListeners && !this._isShared && !this._isDisposed) {
            this._isDisposed = true;
            this.dispose();
            this.broadcast.emit(DISCONNECT_EVENT).catch(() => undefined);
        }
    };

    /**
     * Creates a new Observer.
     * @template T - The type of the value emitted by the observer.
     * @param callbackfn - A function to apply to each value emitted by the observer.
     * @returns - The created Observer.
     */
    public map = <T = any>(callbackfn: (value: Data) => T): Observer<T> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<T>(dispose);
        const handler = async (value: Data): Promise<void> => {
            let pendingValue: T;
            try {
                const raw = callbackfn(value) as any;
                pendingValue = raw && raw instanceof Promise ? await raw : raw;
            } catch (e) {
                // local callback error: notify this chain; a downstream emit
                // error was already reported at the throwing level — propagate only
                observer.emitError(e);
                throw e;
            }
            await observer.emit(pendingValue);
        };
        this._subscribe(observer, handler);
        unsubscribeRef = () => this._unsubscribe(handler);
        return observer;
    };

    /**
     * Applies a callback function to each value emitted by the Observable and flattens the resulting values into a new Observable.
     *
     * @template T - The type of values emitted by the Observable.
     * @param callbackfn - A callback function that accepts a value emitted by the Observable and returns an array of values or a single value.
     * @returns - A new Observer that emits the flattened values.
     */
    public flatMap = <T = any>(callbackfn: (value: Data) => T[]): Observer<T> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<T>(dispose);
        const process = queued(async (value: Data) => {
            let pendingValue: T[] | T;
            try {
                pendingValue = callbackfn(value);
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
            if (Array.isArray(pendingValue)) {
                for (const v of pendingValue) {
                    await observer.emit(v);
                }
            } else {
                await observer.emit(pendingValue);
            }
        });
        const handler = (value: Data) => process(value);
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => this._unsubscribe(handler),
            // cancel, not clear: clear() only forgets the cancel handles, so a
            // queued invocation would still run the user callback after teardown
            () => process.cancel(),
        );
        return observer;
    };

    /**
     * Operator function to create a new observer with a transformed data type.
     *
     * @template T - The type of the transformed data.
     * @param callbackfn - A callback function that takes the target observer and returns a new observer with transformed data.
     * @returns - A new observer with the transformed data type.
     */
    public operator = <T = any>(callbackfn: (target: TObserver<Data>) => TObserver<T>): TObserver<T> => {
        return callbackfn(this);
    };

    /**
     * Reduces the data emitted by an Observer using a callback function and an initial value.
     *
     * @template T - The type of the accumulator and the return value.
     * @param callbackfn - The callback function to execute on each emitted value.
     *   It takes an accumulator value and the current value being emitted, and returns the new accumulator value.
     * @param begin - The initial value of the accumulator.
     * @returns - An Observer that emits the accumulated value after each emission.
     */
    public reduce = <T = any>(callbackfn: (acm: T, cur: Data) => T, begin: T): Observer<T> => {
        let unsubscribeRef: Fn;
        let acm: T = begin;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<T>(dispose);
        const handler = async (value: Data): Promise<void> => {
            let pendingValue: T;
            try {
                const raw = callbackfn(acm, value) as any;
                pendingValue = raw && raw instanceof Promise ? await raw : raw;
                acm = pendingValue;
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
            await observer.emit(pendingValue);
        };
        this._subscribe(observer, handler);
        unsubscribeRef = () => this._unsubscribe(handler);
        return observer;
    };

    /**
     * Creates and returns an observer function that splits an array of data
     * into a nested array of a specified length.
     *
     * @returns The split observer function.
     */
    public split = (): Observer<ReadonlyArray<FlatArray<Data[], 20>>> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer(dispose);
        const process = queued(async (data: Data) => {
            let items: any[] | null = null;
            try {
                if (Array.isArray(data)) {
                    items = data.flat(Number.POSITIVE_INFINITY);
                }
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
            if (items) {
                for (const item of items) {
                    await observer.emit(item);
                }
            } else {
                await observer.emit(data);
            }
        });
        const handler = (data: Data) => process(data);
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => this._unsubscribe(handler),
            // cancel, not clear: see flatMap
            () => process.cancel(),
        );
        return observer;
    };

    /**
     * Creates an Observer with asynchronous mapping functionality.
     *
     * @template T - The type of the result of the mapping function.
     * @param callbackfn - The function used to map the incoming data.
     * @param [fallbackfn] - An optional fallback function to handle error cases. If not provided, the error will be rethrown.
     * @returns - The created Observer.
     */
    public mapAsync = <T = any>(callbackfn: (value: Data) => Promise<T>, fallbackfn?: (e: Error) => void): Observer<T> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<T>(dispose);
        const iteraction = queued(callbackfn);
        const handler = async (value: Data) => {
            let pendingValue: T | typeof CANCELED_PROMISE_SYMBOL;
            try {
                pendingValue = await iteraction(value);
            } catch (e: any) {
                // the boundary covers only the user callback: fallbackfn must
                // not swallow downstream consumer errors
                if (fallbackfn) {
                    fallbackfn(e);
                    return;
                }
                observer.emitError(e);
                throw e;
            }
            if (pendingValue !== CANCELED_PROMISE_SYMBOL) {
                await observer.emit(pendingValue);
            }
        };
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => this._unsubscribe(handler),
            // cancel, not clear: queued invocations resolve CANCELED_PROMISE_SYMBOL
            // and the guard above skips them — clear() would let them run
            () => iteraction.cancel(),
        );
        return observer;
    };

    /**
     * Creates a filtered observer.
     *
     * @param callbackfn - The filter callback function.
     * @returns The filtered observer.
     */
    public filter = (callbackfn: (value: Data) => boolean): Observer<Data> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<Data>(dispose);
        const handler = async (value: Data): Promise<void> => {
            let delegate: boolean;
            try {
                const raw = callbackfn(value) as any;
                delegate = raw && raw instanceof Promise ? await raw : raw;
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
            if (delegate) await observer.emit(value);
        };
        this._subscribe(observer, handler);
        unsubscribeRef = () => this._unsubscribe(handler);
        return observer;
    };

    /**
     * Attaches a callback function to the tap observer. The callback function will be called with a value of type `Data` when the tap observer is triggered.
     *
     * @param callbackfn - A callback function that takes a value of type `Data` as an argument.
     * @returns - An observer object that can be used to manage the tap subscription.
     */
    public tap = (callbackfn: (value: Data) => void): Observer<Data> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<Data>(dispose);
        const handler = async (value: Data): Promise<void> => {
            try {
                const r = callbackfn(value) as any;
                if (r && r instanceof Promise) await r;
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
            await observer.emit(value);
        };
        this._subscribe(observer, handler);
        unsubscribeRef = () => this._unsubscribe(handler);
        return observer;
    };

    /**
     * Creates a debounced observer that emits values at a specified delay.
     *
     * @param delay - The delay (in milliseconds) between value emissions.
     * @returns The debounced observer.
     */
    public debounce = (delay = 1_000): Observer<Data> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<Data>(dispose);
        let token: symbol | null = null;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let prevAwaiter: ReturnType<typeof createAwaiter>[1] | null = null;
        const handler = (value: Data): Promise<void> => {
            if (timeout !== null) { clearTimeout(timeout); timeout = null; }
            if (prevAwaiter) { prevAwaiter.resolve(undefined as any); prevAwaiter = null; }
            const current = token = Symbol();
            const [promise, awaiter] = createAwaiter<void>();
            prevAwaiter = awaiter;
            timeout = setTimeout(() => {
                timeout = null;
                prevAwaiter = null;
                if (token !== current) { awaiter.resolve(undefined as any); return; }
                const result = observer.emit(value) as any;
                if (result && result instanceof Promise) {
                    result.then(awaiter.resolve, awaiter.reject);
                } else {
                    awaiter.resolve(result);
                }
            }, delay);
            return promise;
        };
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => {
                // release the upstream emit awaiting the debounced value,
                // otherwise the source's emit loop hangs forever
                if (prevAwaiter) {
                    prevAwaiter.resolve(undefined as any);
                    prevAwaiter = null;
                }
            },
            () => { if (timeout !== null) { clearTimeout(timeout); timeout = null; } },
            () => this._unsubscribe(handler),
        );
        return observer;
    };

    /**
     * Creates a delayed observer that emits values at a specified delay.
     *
     * @param delay - The delay (in milliseconds) between value emissions.
     * @returns The debounced observer.
     */
    public delay = (delay?: number): Observer<Data> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const observer = new Observer<Data>(dispose);
        let isCanceled = false;
        const handler = queued(async (value: Data) => {
            await sleep(delay);
            if (!isCanceled) {
                await observer.emit(value);
            }
        });
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => handler.clear(),
            () => this._unsubscribe(handler),
            () => { isCanceled = true; },
        );
        return observer;
    };

    /**
     * Emits the specified data to all observers.
     *
     * @param data - The data to be emitted.
     */
    public emit = async (data: Data) => {
        await this.broadcast.emit(OBSERVER_EVENT, data);
    };

    /**
     * Subscribes to the `OBSERVER_EVENT` and invokes the provided callback function.
     * Emits the `CONNECT_EVENT`.
     * Returns a composed function that will try to dispose and unsubscribe the callback.
     *
     * @param callbackfn - The callback function to be invoked when `OBSERVER_EVENT` is emitted.
     * @returns - The composed function that will try to dispose and unsubscribe the callback.
     */
    public connect = (callbackfn: (value: Data) => void) => {
        const handler = async (value: Data) => {
            try {
                const r = callbackfn(value) as any;
                if (r && r instanceof Promise) await r;
            } catch (e) {
                this.emitError(e);
                throw e;
            }
        };
        this.broadcast.subscribe(OBSERVER_EVENT, handler);
        // a synchronously throwing source emitter must surface on the
        // error channel, not as a floating rejection
        this.broadcast.emit(CONNECT_EVENT).catch((e) => this.emitError(e));
        return compose(
            () => this.tryDispose(),
            () => this._unsubscribe(handler),
        );
    };

    /**
     * Executes a callback function once and provides a way to unsubscribe from further executions.
     *
     * @param callbackfn - The callback function to be executed once.
     * @returns - A function that can be called to unsubscribe from further executions of the callback.
     */
    public once = (callbackfn: (value: Data) => void) => {
        let fired = false;
        let unsubscribeRef: Fn = () => undefined;
        const handler = async (value: Data) => {
            if (fired) return;
            fired = true;
            unsubscribeRef();
            const r = callbackfn(value) as any;
            if (r && r instanceof Promise) await r;
        };
        unsubscribeRef = this.connect(handler);
        if (fired) unsubscribeRef();
        return unsubscribeRef;
    };

    /**
     * Marks a variable as shared.
     *
     * @returns The shared variable object.
     */
    public share = () => {
        this._isShared = true;
        return this;
    };

    /**
     * Creates an observable sequence that emits values at specified intervals.
     * @param [interval=1000] - The time interval between emissions in milliseconds.
     * @returns The observer object to subscribe to.
     */
    public repeat = (interval = 1_000) => {
        let unsubscribeRef: Fn;
        let timeout: ReturnType<typeof setTimeout>;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
            () => timeout !== undefined && clearTimeout(timeout),
        );
        const observer = new Observer<Data>(dispose);
        const handler = (value: Data) => {
            if (timeout !== undefined) {
                clearTimeout(timeout);
            }
            const result = observer.emit(value);
            if (observer.hasListeners) {
                timeout = setTimeout(() => {
                    // a timer-driven re-emit has no awaiting parent —
                    // route its rejection to the error channel
                    handler(value).catch((e) => observer.emitError(e));
                }, interval);
            }
            return result;
        };
        this._subscribe(observer, handler);
        unsubscribeRef = () => this._unsubscribe(handler);
        return observer;
    };

    /**
     * Merges an observer with the given observer, returning a new observer that emits values from both observers.
     *
     * @template T - The type of value emitted by the observer.
     * @param observer - The observer to merge with.
     * @returns - The merged observer.
     */
    public merge = <T = any>(observer: TObserver<T>): Observer<Data | T> => {
        let unsubscribeRef: Fn;
        const dispose = compose(
            () => this.tryDispose(),
            () => unsubscribeRef(),
        );
        const merged = new Observer<Data | T>(dispose);
        const handler = (value: Data | T) => {
            return merged.emit(value);
        };
        this._subscribe(merged, handler);
        let unsubscribe: Fn = () => undefined;
        let unsubscribeRightError: Fn = () => undefined;
        merged[LISTEN_CONNECT](() => {
            // duck-typed: multicast/createObserver wrappers expose onError without
            // being Observer instances; unicast excluded — its every accessor
            // call spawns a fresh underlying instance
            if (typeof observer.onError === 'function' && !(observer as any).isUnicasted) {
                unsubscribeRightError = observer.onError((e) => merged.emitError(e));
            }
            unsubscribe = observer.connect(handler) || (() => undefined);
        });
        unsubscribeRef = compose(
            () => this._unsubscribe(handler),
            () => unsubscribe(),
            () => unsubscribeRightError(),
        );
        return merged;
    };

    /**
     * Unsubscribes from all events and performs cleanup.
     */
    public unsubscribe = () => {
        // dispose first so the parent's disconnect listener sees this
        // observer detached; emit before unsubscribeAll or the listener
        // registered by the parent is wiped and never runs
        if (!this._isDisposed) {
            this._isDisposed = true;
            this.dispose();
            this.broadcast.emit(DISCONNECT_EVENT).catch(() => undefined);
        }
        this.broadcast.unsubscribeAll();
    };

    /**
     * Converts the current instance to a Promise that resolves with the data.
     *
     * @returns A Promise that resolves with the data.
     */
    public toPromise = singlerun(() => {
        // already disposed: CONNECT/DISCONNECT will never fire again, so a
        // fresh subscription would hang forever — settle immediately
        if (this._isDisposed) {
            return Promise.reject(new Error('functools-kit toPromise called on a disposed Observer'));
        }
        const [promise, awaiter] = createAwaiter<Data>();
        let isDisposed = false;
        const errorHandler = (error: unknown) => {
            if (isDisposed) return;
            isDisposed = true;
            this.broadcast.unsubscribe(ERROR_EVENT, errorHandler);
            unsub && unsub();
            awaiter.reject(error);
        };
        this.broadcast.subscribe(ERROR_EVENT, errorHandler);
        // observer torn down externally while pending: settle instead of
        // hanging forever (singlerun would pin the dead promise otherwise)
        this[LISTEN_DISCONNECT](() => {
            if (isDisposed) return;
            isDisposed = true;
            this.broadcast.unsubscribe(ERROR_EVENT, errorHandler);
            awaiter.reject(new Error('functools-kit Observer disposed while toPromise was pending'));
        });
        let unsub: Fn;
        unsub = this.connect((value) => {
            if (isDisposed) return;
            isDisposed = true;
            this.broadcast.unsubscribe(ERROR_EVENT, errorHandler);
            unsub && unsub();
            awaiter.resolve(value);
        });
        // a value or error delivered synchronously during connect fires
        // before unsub is assigned — release the subscription here
        if (isDisposed) {
            unsub();
        }
        return promise;
    });

    /**
     * Creates a context for iterating asynchronously using a generator function.
     *
     * @returns The iterator context object.
     * @property iterate - The generator function that can be used to iterate over the values.
     * @property done - Marks the iteration as complete.
     */
    public toIteratorContext = () => {
        const buffer: Data[] = [];
        let isDone = false;
        let isStopped = false;
        let pendingError: unknown = undefined;
        let hasError = false;
        let awaiter: ReturnType<typeof createAwaiter<void>>[1] | null = null;
        const wake = () => {
            if (awaiter) {
                const a = awaiter;
                awaiter = null;
                a.resolve();
            }
        };
        // error subscription goes first: a cold source connecting
        // synchronously can fail before connect() returns
        const unsubError = this.onError((error) => {
            hasError = true;
            pendingError = error;
            isDone = true;
            wake();
        });
        const unsub = this.connect((value) => {
            buffer.push(value);
            wake();
        });
        const stop = () => {
            if (isStopped) return;
            isStopped = true;
            isDone = true;
            wake();
            unsub();
            unsubError();
        };
        // observer torn down externally: end iteration instead of hanging
        this[LISTEN_DISCONNECT](stop);
        // already disposed before the call: DISCONNECT was emitted in the
        // past, the listener above will never fire — end the iteration now
        if (this._isDisposed) {
            stop();
        }
        const iterate = async function* () {
            try {
                while (!isDone || buffer.length > 0) {
                    if (buffer.length === 0) {
                        const [promise, a] = createAwaiter<void>();
                        awaiter = a;
                        await promise;
                    }
                    while (buffer.length > 0) {
                        yield buffer.shift() as Data;
                    }
                    if (hasError) throw pendingError;
                }
                // an error that arrived before iteration started (or with an
                // empty buffer) never enters the loop body — rethrow here
                if (hasError) throw pendingError;
            } finally {
                stop();
            }
        };
        return {
            iterate,
            done: stop,
        }
    };

};

export { TObserver };

export default Observer;
