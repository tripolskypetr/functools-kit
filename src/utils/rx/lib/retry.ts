import type TObserver from "../../../model/TObserver";
import Observer, { LISTEN_CONNECT, LISTEN_DISCONNECT } from "../Observer";

/**
 * Retries delivering each value to downstream subscribers up to `attempts`
 * additional times before propagating the exception.
 *
 * @param attempts - Maximum number of retry attempts after the first failure.
 * @returns An operator function.
 */
export const retry = <T = any>(attempts: number) => (target: TObserver<T>): TObserver<T> => {
    let unsub: () => void = () => undefined;
    const inner = new Observer<T>(() => unsub());
    inner[LISTEN_CONNECT](() => {
        unsub = target.connect(async (value: T) => {
            let lastError: unknown;
            for (let i = 0; i <= attempts; i++) {
                try {
                    await inner.emit(value);
                    return;
                } catch (e) {
                    lastError = e;
                }
            }
            throw lastError;
        });
    });
    inner[LISTEN_DISCONNECT](() => {
        unsub();
        unsub = () => undefined;
    });
    return inner;
};

export default retry;
