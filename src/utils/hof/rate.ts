import memoize, { IClearableMemoize as IClearableRateInternal, IControlMemoize as IControl, IRefMemoize as IRef, GET_VALUE_MAP } from './memoize';

import randomString from '../randomString';

const DEFAULT_DELAY = 1_000;
const DEFAULT_NAME = "unknown-rate";

const NEVER_VALUE = Symbol('never');

export interface IClearableRate<K = string> extends IClearableRateInternal<K> {
    gc: () => void;
}

export class RateError extends Error { 
    type = "rate-error";
}

export const rate = <T extends (...args: any[]) => any, K = string>(run: T, {
    key = () => NEVER_VALUE as never,
    rateName = DEFAULT_NAME,
    delay = DEFAULT_DELAY,
}: {
    key?: (args: Parameters<T>) => K;
    rateName?: string;
    delay?: number;
} = {}): T & IClearableRate<K> & IControl<K, ReturnType<T>> => {

    const wrappedFn = memoize((args) => key(<any>args.slice(1)), (tick: string, ...args: Parameters<T>) => ({
        tick,
        value: run(...args),
        when: Date.now(),
    }));

    /**
     * Executes a wrapped function with a TTL (Time To Live).
     * @param args - The arguments for the wrapped function.
     * @returns - The return value of the wrapped function.
     */
    const executeFn = (...args: Parameters<T>): ReturnType<T> => {
        const currentTime = Date.now();
        const currentTick = randomString();
        const { value, when, tick } = wrappedFn(currentTick, ...args);
        if (currentTime - when < delay) {
            throw new RateError(`functools-kit rate rateName=${rateName} delay not reached`);
        }
        if (tick === currentTick) {
            return value;
        }
        const k = key(args);
        wrappedFn.clear(k);
        return executeFn(...args);
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
        wrappedFn.clear(key);
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
            const currentRate = Date.now();
            if (currentRate - item.current.ttl > delay) {
                wrappedFn.clear(key);
            }
        }
    };

    executeFn.add = (key: K, value: ReturnType<T>) => wrappedFn.add(key, {
        value,
        tick: randomString(),
        when: Date.now(),
    });

    executeFn.remove = wrappedFn.remove;

    return executeFn as T & IClearableRate<K> & IControl<K, ReturnType<T>>;
};

export default rate;
