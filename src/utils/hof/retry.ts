import sleep from '../sleep';

/**
 * Represents a wrapped function that returns a promise.
 * @template T - The type of the promise's resolved value.
 * @template P - The type of the function's arguments.
 */
export interface IWrappedRetryFn<T extends any = any, P extends any[] = any> {
    (...args: P): Promise<T>;
};

/**
 * Retries a function multiple times until it succeeds or reaches the maximum number of attempts.
 *
 * @param run - The function to run.
 * @param count - The maximum number of TOTAL attempts (default is 5): count = 1
 *   performs a single attempt with no retries.
 * @returns - The wrapped function.
 */
export const retry = <T extends any = any, P extends any[] = any[]>(run: (...args: P) => Promise<T>, count = 5, delay = 1_000, condition = (error: Error) => true): IWrappedRetryFn<T, P> => {
    const wrappedFn = async (...args: any) => {
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
                if (!condition(error)) {
                    throw error;
                }
                if (--total <= 0) {
                    throw error;
                }
                await sleep(delay);
                return await call();
            }
        };
        return await call();
    };
    return wrappedFn as unknown as IWrappedRetryFn<T, P>;
};

export default retry;
