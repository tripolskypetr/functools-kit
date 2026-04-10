/**
 * Wraps a function (sync or async) preserving the original return type.
 * Exceptions propagate naturally in both contexts:
 *  - Sync throw   → re-thrown synchronously (no Promise wrapper)
 *  - Async reject → rejection passed through as-is
 *  - Sync return  → value returned directly
 *  - Async resolve → Promise passed through as-is
 *
 * Contrast with `trycatch` which catches exceptions.
 * Sync code stays sync — no forced Promise wrap.
 *
 * @template T - The type of the wrapped function.
 * @param run - The function to wrap.
 * @returns A new function with the same parameters and return type.
 */
export const awaiter = <T extends (...args: any[]) => any>(
    run: T
): (...args: Parameters<T>) => ReturnType<T> => {
    return (...args: Parameters<T>): ReturnType<T> => {
        try {
            const result = run(...args);
            if (result instanceof Promise) {
                return result as ReturnType<T>;
            }
            return result;
        } catch (error) {
            throw error;
        }
    };
};

export default awaiter;
