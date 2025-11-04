/**
 * Interface for objects that can be cleared by key.
 * @template K - The type of the key.
 */
export interface IClearableRouter<K = string> {
    clear: (key?: K) => void;
}

/**
 * Cache entry storing last arguments and computed value
 */
interface ICacheEntry<T> {
    lastArgs: any;
    lastValue: T;
}

/**
 * Combines memoization with caching for each key.
 * Creates a separate cache state for each unique key, allowing
 * independent change tracking per key without memory leaks.
 *
 * @template T - The function type to be memoized and cached
 * @template K - The key type used for memoization routing
 * @param key - Function that generates a unique key from arguments (for routing)
 * @param changed - Function to determine if arguments have changed (for caching within each key)
 * @param run - The function to be memoized and cached
 * @returns - A function with per-key caching and clear methods
 *
 * @example
 * const fn = memoize<(cameraId: number, cacheId: string) => Promise<void>, number>(
 *   ([cameraId]) => cameraId,
 *   ([, cacheIdA], [, cacheIdB]) => cacheIdA !== cacheIdB,
 *   async (cameraId, cacheId) => {
 *     await processCamera(cameraId);
 *   }
 * );
 */
export const router = <T extends (...args: any[]) => any, K = string>(
    key: (args: Parameters<T>) => K,
    changed: (prevArgs: Parameters<T>, currentArgs: Parameters<T>) => boolean,
    run: T
): T & IClearableRouter<K> => {

    /**
     * Map storing cache state per key (only lastArgs and lastValue)
     */
    const cacheMap = new Map<K, ICacheEntry<ReturnType<T>>>();

    /**
     * Clears the cache entries.
     * If a key is provided, clears only that key's cache.
     * If no key is provided, clears all cache entries.
     *
     * @param [key] - The key of the cache entry to clear
     */
    const clear = (key?: K) => {
        if (key !== undefined) {
            cacheMap.delete(key);
            return;
        }
        cacheMap.clear();
    };

    /**
     * Executes the function with per-key caching
     */
    const executeFn = (...args: Parameters<T>) => {
        const k = key(args);
        let entry = cacheMap.get(k);

        if (!entry) {
            // First call for this key
            const value = run(...args);
            cacheMap.set(k, {
                lastArgs: args,
                lastValue: value,
            });
            return value;
        }

        // Check if arguments changed
        if (!changed(entry.lastArgs, args)) {
            return entry.lastValue;
        }

        // Arguments changed, re-execute
        entry.lastArgs = args;
        entry.lastValue = run(...args);
        return entry.lastValue;
    };

    executeFn.clear = clear;

    return executeFn as T & IClearableRouter<K>;
};

export default router;
