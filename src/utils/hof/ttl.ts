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

    /**
     * Creates a memoized function that caches the result of the
     * original function based on the provided key.
     *
     * @param key - The key used to cache the result of the function.
     * @param run - The original function to be memoized.
     * @returns - A memoized function that returns the cached value.
     */
    const wrappedFn = memoize(<any>key, (...args: Parameters<T>) => ({
        value: run(...args),
        ttl: Date.now(),
    }));

    /**
     * Executes a wrapped function with a TTL (Time To Live).
     * @param args - The arguments for the wrapped function.
     * @returns - The return value of the wrapped function.
     */
    const executeFn = (...args: Parameters<T>): ReturnType<T> => {
        const currentTtl = Date.now();
        const { value, ttl } = wrappedFn(...args);
        if (currentTtl - ttl > timeout) {
            const k = key(args);
            wrappedFn.clear(k as string);
            return executeFn(...args);
        }
        return value;
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
        wrappedFn.clear(key as string);
    };

    /**
     * Executes a garbage collection in the ttl storage.
     *
     * @function executeFn.gc
     * @returns
     */
    executeFn.gc = () => {
        const valueMap: Map<K, IRef<{ ttl: number }>> = wrappedFn[GET_VALUE_MAP]();
        for (const [key, item] of valueMap.entries()) {
            const currentTtl = Date.now();
            if (currentTtl - item.current.ttl > timeout) {
                wrappedFn.clear(key as string);
            }
        }
    };

    executeFn.setTimeout = (key: K, nextTimeout: number) => {
        const prevValue = wrappedFn.get(key as string);
        if (prevValue) {
            prevValue.ttl = Date.now() - timeout + nextTimeout;
        }
    };

    executeFn.add = (key: K, value: ReturnType<T>) => wrappedFn.add(key as string, {
        value,
        ttl: Date.now(),
    });

    executeFn.remove = wrappedFn.remove;

    return executeFn as T & IClearableTtl<K> & IControl<K, ReturnType<T>>;
};

export default ttl;
