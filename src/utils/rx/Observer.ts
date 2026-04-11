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
        this.broadcast.emit(ERROR_EVENT, error);
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
            if (!this.hasListeners) {
                this.broadcast.unsubscribe(ERROR_EVENT, errorForwarder);
                this.broadcast.emit(DISCONNECT_EVENT);
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
        if (!this.hasListeners && !this._isShared) {
            this.dispose();
            this.broadcast.emit(DISCONNECT_EVENT);
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
            try {
                const raw = callbackfn(value) as any;
                const pendingValue: T = raw instanceof Promise ? await raw : raw;
                await observer.emit(pendingValue);
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
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
            try {
                const pendingValue = callbackfn(value);
                if (Array.isArray(pendingValue)) {
                    for (const v of pendingValue) {
                        await observer.emit(v);
                    }
                } else {
                    await observer.emit(pendingValue);
                }
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
        });
        const handler = (value: Data) => process(value);
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => this._unsubscribe(handler),
            () => process.clear(),
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
            try {
                const raw = callbackfn(acm, value) as any;
                const pendingValue: T = raw instanceof Promise ? await raw : raw;
                acm = pendingValue;
                await observer.emit(pendingValue);
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
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
            try {
                if (Array.isArray(data)) {
                    for (const item of data.flat(Number.POSITIVE_INFINITY)) {
                        await observer.emit(item);
                    }
                } else {
                    await observer.emit(data);
                }
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
        });
        const handler = (data: Data) => process(data);
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => this._unsubscribe(handler),
            () => process.clear(),
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
            try {
                const pendingValue = await iteraction(value);
                if (pendingValue !== CANCELED_PROMISE_SYMBOL) {
                    await observer.emit(pendingValue);
                }
            } catch (e: any) {
                if (fallbackfn) {
                    fallbackfn(e);
                } else {
                    observer.emitError(e);
                    throw e;
                }
            }
        };
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
            () => this._unsubscribe(handler),
            () => iteraction.clear(),
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
            try {
                const raw = callbackfn(value) as any;
                const delegate: boolean = raw instanceof Promise ? await raw : raw;
                if (delegate) await observer.emit(value);
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
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
                if (r instanceof Promise) await r;
                await observer.emit(value);
            } catch (e) {
                observer.emitError(e);
                throw e;
            }
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
                if (result instanceof Promise) {
                    result.then(awaiter.resolve, awaiter.reject);
                } else {
                    awaiter.resolve(result);
                }
            }, delay);
            return promise;
        };
        this._subscribe(observer, handler);
        unsubscribeRef = compose(
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
                if (r instanceof Promise) await r;
            } catch (e) {
                this.emitError(e);
                throw e;
            }
        };
        this.broadcast.subscribe(OBSERVER_EVENT, handler);
        this.broadcast.emit(CONNECT_EVENT);
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
            if (r instanceof Promise) await r;
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
            if (this.hasListeners) {
                timeout = setTimeout(handler, interval, value);
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
            if (observer instanceof Observer) {
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
        this.broadcast.unsubscribeAll();
        this.broadcast.emit(DISCONNECT_EVENT);
        this.dispose();
    };

    /**
     * Converts the current instance to a Promise that resolves with the data.
     *
     * @returns A Promise that resolves with the data.
     */
    public toPromise = singlerun(() => {
        const [promise, awaiter] = createAwaiter<Data>();
        let isDisposed = false;
        const errorHandler = (error: unknown) => {
            if (isDisposed) return;
            isDisposed = true;
            this.broadcast.unsubscribe(ERROR_EVENT, errorHandler);
            awaiter.reject(error);
        };
        this.broadcast.subscribe(ERROR_EVENT, errorHandler);
        let unsub: Fn;
        unsub = this.connect((value) => {
            if (isDisposed) return;
            isDisposed = true;
            this.broadcast.unsubscribe(ERROR_EVENT, errorHandler);
            unsub && unsub();
            awaiter.resolve(value);
        });
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
        let pendingError: unknown = undefined;
        let hasError = false;
        let awaiter: ReturnType<typeof createAwaiter<void>>[1] | null = null;
        const unsub = this.connect((value) => {
            buffer.push(value);
            if (awaiter) {
                const a = awaiter;
                awaiter = null;
                a.resolve();
            }
        });
        const unsubError = this.onError((error) => {
            hasError = true;
            pendingError = error;
            isDone = true;
            if (awaiter) {
                const a = awaiter;
                awaiter = null;
                a.resolve();
            }
        });
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
            } finally {
                unsub();
                unsubError();
            }
        };
        return {
            iterate,
            done() {
                isDone = true;
                if (awaiter) {
                    const a = awaiter;
                    awaiter = null;
                    a.resolve();
                }
                unsub();
                unsubError();
            },
        }
    };

};

export { TObserver };

export default Observer;
