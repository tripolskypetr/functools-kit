import Observer, { TObserver, LISTEN_CONNECT } from "../Observer";

/**
 * Creates an observer that emits a flattened and filtered array of data.
 *
 * @template Data - The type of data being observed.
 * @param data - The data to observe.
 * @returns - The observer that emits the flattened and filtered array of data.
 */
export const fromArray = <Data = any>(data: Data): TObserver<ReadonlyArray<FlatArray<Data[], 20>>> => {
    const observer = new Observer<any>(() => undefined);
    const process = async () => {
        if (Array.isArray(data)) {
            for (const item of data.flat(Number.POSITIVE_INFINITY)) {
                await observer.emit(item);
            }
        } else {
            await observer.emit(data);
        }
    };
    observer[LISTEN_CONNECT](() => {
        process().catch((e) => observer.emitError(e));
    });
    return observer;
};

export default fromArray;
