import Observer, { TObserver, LISTEN_CONNECT } from "../Observer";

declare var setTimeout: any;

/**
 * Creates a delayed observer that emits a void value after a specified delay.
 *
 * @param delay - The delay in milliseconds before emitting the value.
 * @returns - The delayed observer instance.
 */
export const fromDelay = (delay: number): TObserver<void> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const observer = new Observer<void>(() => {
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
    });
    const process = async () => {
        timeout = undefined;
        await observer.emit();
    };
    observer[LISTEN_CONNECT](() => {
        timeout = setTimeout(() => {
            process().catch((e) => observer.emitError(e));
        }, delay);
    });
    return observer;
};

export default fromDelay;
