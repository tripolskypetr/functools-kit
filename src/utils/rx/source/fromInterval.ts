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
            // a throwing subscriber must not kill the interval:
            // forward the error downstream and keep ticking
            await observer.emit(iterationIdx);
        } catch (e) {
            observer.emitError(e);
        }
        iterationIdx++;
        if (stopped) {
            return;
        }
        timeout = setTimeout(process, delay);
    };
    observer[LISTEN_CONNECT](() => {
        void process();
    });
    return observer;
};

export default fromInterval;
