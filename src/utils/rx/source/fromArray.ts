import Observer, { TObserver, LISTEN_CONNECT } from "../Observer";

/**
 * Creates an observer that emits a flattened and filtered array of data.
 *
 * @template Data - The type of data being observed.
 * @param data - The data to observe.
 * @returns - The observer that emits the flattened and filtered array of data.
 */
export const fromArray = <Data = any>(data: Data): TObserver<ReadonlyArray<FlatArray<Data[], 20>>> => {
    let isCanceled = false;
    const observer = new Observer<any>(() => {
        isCanceled = true;
    });
    const process = async () => {
        if (Array.isArray(data)) {
            for (const item of data.flat(Number.POSITIVE_INFINITY)) {
                if (isCanceled) {
                    return;
                }
                try {
                    await observer.emit(item);
                } catch {
                    // the throwing consumer already reported at its level;
                    // aborting here starved every consumer of the remaining
                    // items — keep delivering the sequence
                }
            }
        } else {
            if (!isCanceled) {
                // consumer throws are already reported at the throwing level
                await observer.emit(data).catch(() => undefined);
            }
        }
    };
    observer[LISTEN_CONNECT](() => {
        process().catch(() => undefined);
    });
    return observer;
};

export default fromArray;
