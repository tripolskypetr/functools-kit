import { TIMEOUT_SYMBOL } from './timeout';

import createAwaiter from "../createAwaiter";
import sleep from "../sleep";

import { TSubject } from "../rx/Subject";

export const waitForNext = async <T = any>(subject: TSubject<T>, condition: (t: T) => boolean, delay = 0): Promise<T | typeof TIMEOUT_SYMBOL> => {
    let unsubscribeRef: Function | undefined;
    let isFinished = false;
    const [promise, { resolve, reject }] = createAwaiter<T | typeof TIMEOUT_SYMBOL>();
    unsubscribeRef = subject.subscribe((value) => {
        let matched = false;
        try {
            matched = condition(value);
        } catch (e) {
            // a throwing condition must settle the waiter and release the
            // subscription instead of hanging both forever
            if (!isFinished) {
                isFinished = true;
                unsubscribeRef && unsubscribeRef();
                reject(e);
            }
            throw e;
        }
        if (matched) {
            unsubscribeRef && unsubscribeRef();
            isFinished = true;
            resolve(value);
        }
    });
    delay && sleep(delay).then(() => {
        if (isFinished) {
            return;
        }
        unsubscribeRef && unsubscribeRef();
        resolve(TIMEOUT_SYMBOL);
    });
    return promise;
};

export default waitForNext;
