import { IAwaiter, createAwaiter } from '../createAwaiter';
import sleep from '../sleep';
import singlerun from './singlerun';

/**
 * Represents a task in the execution pool.
 * 
 * @template T - The type of the result of the task.
 * @template P - The types of the parameters of the task.
 * 
 * @typedef Run
 * @property args - The arguments for the task.
 * @property awaiter - The awaiter for the task.
 */
type Run<T extends any = any, P extends any[] = any> = {
    args: P;
    awaiter: IAwaiter<T>;
}


/**
 * Represents the configuration options for the execution pool.
 * 
 * @interface
 * @property maxExec - The maximum number of executions allowed concurrently.
 * @property delay - The delay in milliseconds between executions.
 */
interface IConfig {
    maxExec: number;
    delay: number;
}

/**
 * Represents a wrapped function that returns a promise.
 * 
 * @template T - The type of the result of the wrapped function.
 * @template P - The types of the parameters of the wrapped function.
 * 
 * @interface
 * @function
 * @param args - The arguments to pass to the wrapped function.
 * @returns A promise that resolves with the result of the wrapped function.
 * @function clear - Clears all pending executions in the execution pool.
 */
export interface IWrappedExecpoolFn<T extends any = any, P extends any[] = any> {
    (...args: P): Promise<T>;
    clear(): void;
}

/**
 * Creates an execution pool for asynchronous functions with a limited concurrency.
 * 
 * @template T - The type of the result of the wrapped function.
 * @template P - The types of the parameters of the wrapped function.
 * 
 * @function
 * @param run - The function to be executed in the pool.
 * @param options - Optional configuration options for the execution pool.
 * @returns A wrapped function that executes asynchronously within the execution pool.
 */
export const execpool = <T extends any = any, P extends any[] = any[]>(run: (...args: P) => Promise<T>, {
    maxExec = 3,
    delay = 10,
}: Partial<IConfig> = {}): IWrappedExecpoolFn<T, P> => {

    const execSet = new Set<Promise<T>>();
    const execStack: Run<T, P>[] = [];

    /**
     * Executes a function with arguments and adds it to the execution pool.
     * 
     * @function
     * @param awaiter - The awaiter to resolve the function execution.
     * @param args - The arguments to pass to the function.
     */
    const execute = async (awaiter: IAwaiter<T>, ...args: P) => {
        let target: Promise<T>;
        try {
            target = run(...args);
        } catch (e) {
            // a synchronously throwing run belongs to this caller only —
            // it must not crash the shared drain loop
            awaiter.reject(e);
            return null as unknown as T;
        }
        const exec = target
            .then((value) => {
                awaiter.resolve(value);
                execSet.delete(exec);
                return value;
            })
            .catch((reason) => {
                awaiter.reject(reason);
                execSet.delete(exec);
                return null as unknown as T;
            });
        execSet.add(exec);
        return await exec;
    };

    /**
     * Initializes the execution loop for the execution pool.
     * 
     * @function
     */
    const initLoop = singlerun(async () => {
        while (execStack.length) {
            if (execSet.size >= maxExec) {
                await Promise.race(execSet);
                if (delay) {
                    await sleep(delay);
                }
                continue;
            }
            const next = execStack.pop();
            if (!next) {
                break;
            }
            // fire without awaiting completion: the backlog must refill the
            // pool to maxExec concurrency, not drain serially; execute never
            // rejects (awaiter carries the outcome)
            void execute(next.awaiter, ...next.args);
        }
    });

    /**
     * The wrapped function that executes within the execution pool.
     * 
     * @function
     * @param args - The arguments to pass to the wrapped function.
     * @returns A promise that resolves with the result of the wrapped function.
     */
    const wrappedFn: IWrappedExecpoolFn<T, P> = async (...args: P): Promise<T> => {
        const [result, awaiter] = createAwaiter<T>();
        if (execSet.size < maxExec) {
            await execute(awaiter, ...args);
        } else {
            const item: Run<T, P> = {
                awaiter,
                args,
            };
            // clear() may reject the awaiter while we are parked on the loop
            // below — observe it early so it never floats unhandled
            result.catch(() => undefined);
            execStack.unshift(item);
            // re-run the loop until our item has actually been picked up (or
            // discarded by clear): joining a loop that is finishing this very
            // tick would otherwise strand the task forever
            while (execStack.includes(item)) {
                await initLoop();
                if (execStack.includes(item)) {
                    await sleep(delay || 1);
                }
            }
        }
        return await result;
    };

    /**
     * Clears all pending executions in the execution pool.
     * 
     * @function
     */
    wrappedFn.clear = () => {
        while (execStack.length) {
            const next = execStack.pop();
            // a discarded task must settle its caller, not hang it forever
            next && next.awaiter.reject(new Error('functools-kit execpool cleared'));
        }
        // execSet is intentionally kept: running tasks still occupy real
        // slots, wiping it would let new calls exceed maxExec
        initLoop.clear();
    };

    return wrappedFn;
};

export default execpool;
