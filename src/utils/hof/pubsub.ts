import createAwaiter, { IAwaiter } from "../createAwaiter";

import singlerun from "./singlerun";
import sleep from "../sleep";

const PUBSUB_TIMEOUT = 30_000;

interface IConfig {
    onDestroy?: () => Promise<void>;
    timeout?: number;
}

export const pubsub = <Data = any>(emitter: (data: Data) => Promise<boolean>, {
    onDestroy,
    timeout = PUBSUB_TIMEOUT,
}: Partial<IConfig> = {}) => {

    const queue: [Data, IAwaiter<void>][] = [];
    let lastOk = Date.now();
    let isStopped = false;

    const handleStop = async () => {
        if (isStopped) {
            return;
        }
        if (onDestroy) {
            await onDestroy();
        }
        isStopped = true;
    };

    const makeBroadcast = singlerun(async () => {
        if (isStopped) {
            return;
        }
        while (queue.length) {
            const [[data, { resolve }]] = queue;
            const success = await emitter(data);
            if (success) {
                lastOk = Date.now();
                queue.shift();
                resolve();
                continue;
            }
            await sleep(1_000);
            if (Date.now() - lastOk >= timeout) {
                await handleStop();
                return;
            }
        }
    });

    const wrappedFn = async (data: Data) => {
        if (isStopped) {
            return;
        }
        const [result, awaiter] = createAwaiter<void>();
        queue.push([data, awaiter]);
        await makeBroadcast();
        return await result;
    };

    wrappedFn.stop = handleStop;

    return wrappedFn;
};

export default pubsub;
