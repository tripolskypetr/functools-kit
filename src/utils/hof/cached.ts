
/**
 * Interface for objects that can be cleared.
 *
 * @interface
 */
export interface IClearableCached {
    clear: () => void;
}

/**
 * Caches the result of a function based on the change of arguments.
 * @template T - The type of the function to be cached.
 * @template A - The type of the arguments of the function.
 * @param changed - Function to determine if the arguments have changed.
 * @param run - The function to be cached.
 * @returns - The cached function with additional clear method.
 */
export const cached = <T extends (...args: any[]) => any>(changed: (prevArgs: Parameters<T>, currentArgs: Parameters<T>) => boolean, run: T): T & IClearableCached => {

    let lastArgs: any = null;
    let initial = true;
    let lastValue: ReturnType<typeof run>;

    /**
     * Clears the value of the lastArgs variable.
     * @function
     * @name clear
     * @returns
     */
    const clear = () => {
        lastArgs = null;
        initial = true;
    };

    /**
     * Executes a function with given arguments and caches the result.
     *
     * @param args - The arguments to be passed to the function.
     * @returns - The result of the executed function.
     */
    const executeFn = (...args: Parameters<T>) => {
        if (!initial) {
            if (!changed(lastArgs, args)) {
                return lastValue;
            }
        }
        // commit state only after run succeeds: a sync throw must not pair
        // the new args with the previous value
        const value = run(...args);
        lastArgs = args;
        initial = false;
        lastValue = value;
        // @ts-ignore
        if (value instanceof Promise) {
            value.catch(() => {
                // a stale rejection must not wipe a newer cached value
                if (lastValue === value) {
                    clear();
                }
            });
        }
        return value;
    };

    executeFn.clear = clear;

    return executeFn as T & IClearableCached;
};

export default cached;
