import queued, { CANCELED_PROMISE_SYMBOL } from "./queued";

/**
 * Represents a wrapped function that returns a promise.
 * @template T - The type of the promise's resolved value.
 * @template P - The type of the function's arguments.
 */
export interface IWrappedRetryFn<T extends any = any, P extends any[] = any> {
    (...args: P): Promise<T | typeof CANCELED_PROMISE_SYMBOL>;
    cancel(): void;
    clear(): void;
};

/**
 * Retries a function multiple times until it succeeds or reaches the maximum number of retries.
 *
 * @param run - The function to run.
 * @param count - The maximum number of retries (default is 5).
 * @returns - The wrapped function that can be canceled.
 */
export const retry = <T extends any = any, P extends any[] = any[]>(run: (...args: P) => Promise<T>, count = 5): IWrappedRetryFn<T, P> => {
    const wrappedFn = queued(async (...args: any) => {
        let total = count;        
        /**
         * Calls the function `run` repeatedly until it successfully completes or `total` reattempts have been made.
         *
         * @async
         * @returns A Promise that resolves with the result of the successful call to `run`.
         * @throws If the limit of reattempts is reached and `run` still throws an error.
         */
        const call = async (): Promise<any> => {
            try {
                return await run(...args);
            } catch (error) {
                if (--total === 0) {
                    throw error;
                }
                return await call();
            }
        };
        return await call();
    });
    return wrappedFn as unknown as IWrappedRetryFn<T, P>;
};

export default retry;
