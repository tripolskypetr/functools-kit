import Observer, { TObserver, LISTEN_CONNECT } from "../Observer";

/**
 * Creates an observable that emits the result of a given promise callback function.
 *
 * @param callbackfn - The callback function that returns a promise.
 * @param [fallbackfn] - The fallback function to handle errors if the promise rejects.
 * @returns - The observable observer.
 *
 * @template Data - The type of data emitted by the observer.
 */
export const fromPromise = <Data = any>(callbackfn: () => Promise<Data>, fallbackfn?: (e: Error) => void): TObserver<Data> => {
    let isCanceled = false;
    const observer = new Observer<Data>(() => {
        isCanceled = true;
    });
    const process = async () => {
        let result: Data;
        try {
            result = await callbackfn();
        } catch (e: any) {
            if (isCanceled) {
                return;
            }
            if (fallbackfn) {
                fallbackfn(e);
                return;
            }
            // the callback failure was never reported anywhere else — this
            // is its single report
            observer.emitError(e);
            return;
        }
        if (!isCanceled) {
            // a consumer throw, by contrast, was already reported at the
            // throwing level — re-reporting it here doubled the error
            await observer.emit(result).catch(() => undefined);
        }
    };
    observer[LISTEN_CONNECT](() => {
        void process();
    });
    return observer;
};

export default fromPromise;
