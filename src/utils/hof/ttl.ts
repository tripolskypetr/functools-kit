import memoize, { IClearableMemoize as IClearableTtlInternal, IControlMemoize as IControl, IRefMemoize as IRef, GET_VALUE_MAP } from './memoize';

/**
 * Represents the default timeout value in milliseconds.
 *
 * @constant {number} DEFAULT_TIMEOUT - The value of the default timeout.
 */
const DEFAULT_TIMEOUT = 250;
/**
 * A unique symbol representing a value that should never occur.
 *
 * @type {symbol}
 */
const NEVER_VALUE = Symbol('never');

/**
 * Represents a clearable object that can be garbage collected.
 *
 * @template K - The type of key used for clearing.
 */
export interface IClearableTtl<K = string> extends IClearableTtlInternal<K> {
    gc: () => void;
    setTimeout: (key: K, timeout: number) => void;
}

/**
 * Wrap a function with time-to-live (TTL) caching.
 *
 * @template T - The function type.
 * @template A - The argument types of the function.
 * @template K - The key type for caching.
 * @param run - The function to wrap.
 * @param options - The configuration options.
 * @param [options.key] - The key generator function that generates a key based on function arguments.
 * @param [options.timeout] - The TTL duration in milliseconds.
 * @returns - The wrapped function with caching capability.
 */
export const ttl = <T extends (...args: any[]) => any, K = string>(run: T, {
    key = () => NEVER_VALUE as never,
    timeout = DEFAULT_TIMEOUT,
}: {
    key?: (args: Parameters<T>) => K;
    timeout?: number;
} = {}): T & IClearableTtl<K> & IControl<K, ReturnType<T>> => {

    const timeoutOverride = new Map<K, number>();

    /**
     * Creates a memoized function that caches the result of the
     * original function based on the provided key.
     *
     * @param key - The key used to cache the result of the function.
     * @param run - The original function to be memoized.
     * @returns - A memoized function that returns the cached value.
     */
    const wrappedFn = memoize(<any>key, (...args: Parameters<T>) => {
        const k = key(args);
        const record = {
            value: run(...args),
            ttl: Date.now(),
            pending: false,
        };
        if (record.value instanceof Promise) {
            // a still-running computation must not be treated as expired —
            // that causes a stampede of concurrent recomputes for one key
            record.pending = true;
            record.value.then(
                () => { record.pending = false; record.ttl = Date.now(); },
                () => {
                    record.pending = false;
                    // memoize cannot see the promise inside the record —
                    // evict here so the next call retries; identity-guarded
                    // against wiping a newer entry
                    if (wrappedFn.get(k as string) === record) {
                        wrappedFn.clear(k as string);
                    }
                },
            );
        }
        return record;
    });

    /**
     * Executes a wrapped function with a TTL (Time To Live).
     * @param args - The arguments for the wrapped function.
     * @returns - The return value of the wrapped function.
     */
    const executeFn = (...args: Parameters<T>): ReturnType<T> => {
        const currentTtl = Date.now();
        const k = key(args);
        const record = wrappedFn(...args);
        const targetTimeout = timeoutOverride.get(k) ?? timeout;
        // rejection eviction is handled inside memoize with an identity
        // guard; pending records are never expired
        if (!record.pending && currentTtl - record.ttl > targetTimeout) {
            wrappedFn.clear(k as string);
            timeoutOverride.delete(k);
            return wrappedFn(...args).value;
        }
        return record.value;
    };

    /**
     * Clears the executeFn function.
     *
     * @function
     * @memberof executeFn
     * @name clear
     *
     * @returns
     */
    executeFn.clear = (key?: K) => {
        // key !== undefined, not truthiness: clear(0) or clear("") must not
        // wipe every timeout override
        if (key !== undefined) {
            timeoutOverride.delete(key);
        } else {
            timeoutOverride.clear();
        }
        wrappedFn.clear(key as string);
    };

    /**
     * Executes a garbage collection in the ttl storage.
     *
     * @function executeFn.gc
     * @returns
     */
    executeFn.gc = () => {
        const valueMap: Map<K, IRef<{ ttl: number; pending?: boolean }>> = wrappedFn[GET_VALUE_MAP]();
        for (const [key, item] of valueMap.entries()) {
            const currentTtl = Date.now();
            const targetTimeout = timeoutOverride.get(key) ?? timeout;
            if (!item.current.pending && currentTtl - item.current.ttl > targetTimeout) {
                wrappedFn.clear(key as string);
                timeoutOverride.delete(key);
            }
        }
    };

    executeFn.setTimeout = (key: K, nextTimeout: number) => {
        if (wrappedFn.has(key as string)) {
            timeoutOverride.set(key, nextTimeout);
        }
    };

    executeFn.add = (key: K, value: ReturnType<T>) => wrappedFn.add(key as string, {
        value,
        ttl: Date.now(),
        pending: false,
    });

    executeFn.remove = wrappedFn.remove;

    executeFn.has = (key: K) => wrappedFn.has(key as string);

    executeFn.get = (key: K): ReturnType<T> | undefined => {
        const record = wrappedFn.get(key as string);
        return record ? record.value : undefined;
    };

    executeFn.values = () => wrappedFn.values().map(({ value }) => value);

    executeFn.keys = () => wrappedFn.keys() as K[];

    return executeFn as T & IClearableTtl<K> & IControl<K, ReturnType<T>>;
};

export default ttl;
