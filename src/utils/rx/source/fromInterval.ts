import Observer, { TObserver, LISTEN_CONNECT } from "../Observer";

declare var setTimeout: any;

/**
 * Creates an observer that emits a value after a specified delay.
 *
 * @param delay - The delay in milliseconds.
 * @returns - The observer that emits values after the specified delay.
 */
export const fromInterval = (delay: number): TObserver<number> => {
    let timeout: ReturnType<typeof setTimeout>;
    let stopped = false;
    let iterationIdx = 0;
    const observer = new Observer<number>(() => {
        stopped = true;
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
    });
    const process = async () => {
        if (stopped) {
            return;
        }
        try {
            // a throwing subscriber must not kill the interval: keep ticking.
            // The error was already reported at the throwing level (connect
            // handler emitErrors before rethrowing) — no second report here
            await observer.emit(iterationIdx);
        } catch {
            /* already reported */
        }
        iterationIdx++;
        if (stopped) {
            return;
        }
        timeout = setTimeout(process, delay);
    };
    observer[LISTEN_CONNECT](() => {
        // defer the first tick by a microtask: emitting synchronously inside
        // connect() fires before the caller had a chance to attach onError,
        // making a first-tick error unobservable
        void Promise.resolve().then(process);
    });
    return observer;
};

export default fromInterval;
