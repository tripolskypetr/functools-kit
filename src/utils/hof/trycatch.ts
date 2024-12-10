export const CATCH_SYMBOL = Symbol("default");

export interface IErrorTrycatch extends Error {}

/**
 * Represents a configuration interface.
 *
 * @interface
 */
export interface IControllTrycatch<DefaultValue = typeof CATCH_SYMBOL> {
    allowedErrors?: { new (): IErrorTrycatch }[];
    fallback?: (error: Error) => void;
    defaultValue: DefaultValue;
}

/**
 * Asynchronously waits for a promise to resolve and handles any errors that occur.
 *
 * @param value - The promise to await.
 * @param config - The configuration options.
 * @param config.fallback - The fallback function to call if an error occurs.
 * @param config.defaultValue - The default value to return if an error occurs.
 * @returns - A promise that resolves to the resolved value of the input promise, or the defaultValue if an error occurs.
 *
 */
const awaiter = async <V, D>(
    value: Promise<V>,
    { fallback, defaultValue }: IControllTrycatch<D>
): Promise<V | D> => {
    try {
        return await value;
    } catch (error) {
        fallback && fallback(error as Error);
        return defaultValue;
    }
};

/**
 * A higher-order function that wraps the provided function with a try-catch block. It catches any errors that occur during the execution of the function and handles them according to
 * the specified configuration.
 *
 * @template T - The type of the function being wrapped
 * @template A - An array of arguments that the function accepts
 * @template V - The type of the value returned by the function
 * @template D - The type of the default value to return in case of error
 *
 * @param run - The function to be wrapped
 * @param config - The configuration object
 * @param config.fallback - The fallback function to be called with the caught error (optional)
 * @param config.defaultValue - The default value to be returned if an error occurs
 *
 * @returns - The wrapped function that handles errors and returns the result or the default value
 */
export const trycatch = <
    T extends (...args: any[]) => any,
    V,
    D = typeof CATCH_SYMBOL
>(
    run: T,
    {
        allowedErrors,
        fallback,
        defaultValue = CATCH_SYMBOL as D,
    }: Partial<IControllTrycatch<D>> = {}
): (...args: Parameters<T>) => ReturnType<T> | D => {
    return (...args) => {
        try {
            const result = run(...args);
            if (result instanceof Promise) {
                return awaiter<V, D>(result, { fallback, defaultValue });
            }
            return result;
        } catch (error) {
            fallback && fallback(error as Error);
            if (allowedErrors) {
                for (const BaseError of allowedErrors) {
                    if (error instanceof BaseError) {
                        return defaultValue;
                    }
                }
                throw error;
            }
            return defaultValue;
        }
    };
};

export default trycatch;
