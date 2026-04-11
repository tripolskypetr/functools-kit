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

export class Observer<Data = any> implements TObserver<Data> {

    private readonly broadcast = new EventEmitter();
    private _isShared = false;

    public get isShared() {
        return this._isShared;
    };

    public get hasListeners() {
        return !!this.broadcast.getListeners(OBSERVER_EVENT).length;
    };

    constructor(private readonly dispose: Fn) { }

    public emitError = (error: unknown) => {
        this.broadcast.emit(ERROR_EVENT, error);
    };

    public onError = (fn: (error: unknown) => void) => {
        this.broadcast.subscribe(ERROR_EVENT, fn);
        return () => this.broadcast.unsubscribe(ERROR_EVENT, fn);
    };

    [LISTEN_CONNECT](fn: () => void) {
        this.broadcast.once(CONNECT_EVENT, fn);
    };

    [LISTEN_DISCONNECT](fn: () => void) {
        this.broadcast.once(DISCONNECT_EVENT, fn);
    };

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

    private _unsubscribe = (callback: Fn) => {
        this.broadcast.unsubscribe(OBSERVER_EVENT, callback);
    };

    private tryDispose = () => {
        if (!this.hasListeners && !this._isShared) {
            this.dispose();
            this.broadcast.emit(DISCONNECT_EVENT);
        }
    };

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

    public operator = <T = any>(callbackfn: (target: TObserver<Data>) => TObserver<T>): TObserver<T> => {
        return callbackfn(this);
    };

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

    public emit = async (data: Data) => {
        await this.broadcast.emit(OBSERVER_EVENT, data);
    };

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

    public share = () => {
        this._isShared = true;
        return this;
    };

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

    public unsubscribe = () => {
        this.broadcast.unsubscribeAll();
        this.broadcast.emit(DISCONNECT_EVENT);
        this.dispose();
    };

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

    public toIteratorContext = () => {
        const self = this;
        let isDone = false;
        const iterate = async function* () {
            while (!isDone) {
                const next = await self.toPromise();
                yield next as Data;
            }
        };
        return {
            iterate,
            done() {
                isDone = true;
            },
        }
    };

};

export { TObserver };

export default Observer;
