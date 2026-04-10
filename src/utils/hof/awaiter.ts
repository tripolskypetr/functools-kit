/**
 * Wraps a function (sync or async) so that exceptions always propagate
 * as rejected Promises through the chain.
 *
 * Contrast with `trycatch` which catches exceptions and returns a `defaultValue`.
 * `awaiter` does not catch — it normalizes the exception path:
 *  - Sync return  → Promise.resolve(value)
 *  - Sync throw   → Promise.reject(error)
 *  - Async resolve → Promise.resolve(value) (pass-through)
 *  - Async reject  → Promise.reject(error)  (pass-through)
 *
 * @template T - The type of the wrapped function.
 * @param run - The function to wrap.
 * @returns A new function with the same parameters that always returns a Promise.
 */
export const awaiter = <T extends (...args: any[]) => any>(
    run: T
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> => {
    return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
        try {
            const result = run(...args);
            if (result instanceof Promise) {
                return (async () => await result)() as Promise<Awaited<ReturnType<T>>>;
            }
            return Promise.resolve(result) as Promise<Awaited<ReturnType<T>>>;
        } catch (error) {
            return Promise.reject(error);
        }
    };
};

export default awaiter;
