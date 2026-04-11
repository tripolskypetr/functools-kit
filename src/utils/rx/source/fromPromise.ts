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
        try {
            const result = await callbackfn();
            if (!isCanceled) {
                await observer.emit(result);
            }
        } catch (e: any) {
            if (fallbackfn) {
                fallbackfn(e);
                return;
            }
            throw e;
        }
    };
    observer[LISTEN_CONNECT](() => {
        process().catch((e) => observer.emitError(e));
    });
    return observer;
};

export default fromPromise;
