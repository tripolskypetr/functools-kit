import Observer, { TObserver, LISTEN_CONNECT } from "../Observer";
import createAwaiter from "../../createAwaiter";
import singlerun from "../../hof/singlerun";

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
    let processPromise: Promise<void> | null = null;
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
        processPromise = process();
    });
    observer.toPromise = singlerun(() => {
        const [promise, awaiter] = createAwaiter<Data>();
        const unsub = observer.connect((value) => {
            unsub();
            awaiter.resolve(value);
        });
        processPromise!.catch(awaiter.reject);
        return promise;
    });
    return observer;
};

export default fromPromise;
