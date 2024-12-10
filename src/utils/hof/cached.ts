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
        lastArgs = args;
        initial = false;
        return lastValue = run(...args);
    };

    executeFn.clear = clear;

    return executeFn as T & IClearableCached;
};

export default cached;
