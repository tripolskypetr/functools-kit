import createAwaiter, { IAwaiter } from "../createAwaiter";

import singlerun from "./singlerun";
import sleep from "../sleep";

const PUBSUB_TIMEOUT = 30_000;

export interface IPubsubConfig<Data = any> {
    onDestroy?: () => (Promise<void> | void);
    onData?: (data: Data) => (Promise<void> | void);
    Adapter?: IPubsubArrayFactory<[Data, IAwaiter<void>]>;
    timeout?: number;
}

export interface IPubsubWrappedFn<Data = any> {
    (data: Data): Promise<void>;
    stop: () => Promise<void>;
}

export interface IPubsubArray<T = any> {
  getFirst(): Promise<T | null>;
  push(value: T): Promise<void>;
  shift(): Promise<T | null>;
  length(): Promise<number>;
  clear(): Promise<void>;
}

export interface IPubsubArrayFactory<T = any> {
    new (): IPubsubArray<T>;
}

export class PubsubArrayAdapter<T = any> implements IPubsubArray<T> {

    _array: T[] = [];

    length = () => Promise.resolve(this._array.length);

    push = (value: T) => {
        this._array.push(value);
        return Promise.resolve();
    }

    shift = () => Promise.resolve(this._array.shift());

    getFirst(): Promise<T> {
        const [first] = this._array;
        return Promise.resolve(first || null);
    };

    clear = () => {
        while (this._array.length) {
            this._array.pop();
        }
        return Promise.resolve();
    };

}

export const pubsub = <Data = any>(emitter: (data: Data) => Promise<boolean>, {
    onDestroy,
    onData,
    timeout = PUBSUB_TIMEOUT,
    Adapter = PubsubArrayAdapter,
}: Partial<IPubsubConfig<Data>> = {}) => {

    const queue = new Adapter();
    let lastOk = Date.now();
    let isStopped = false;

    const handleStop = async () => {
        if (isStopped) {
            return;
        }
        await queue.clear();
        if (onDestroy) {
            await onDestroy();
        }
        isStopped = true;
    };

    const makeBroadcast = singlerun(async () => {
        if (isStopped) {
            return;
        }
        while (await queue.length()) {
            const first = await queue.getFirst();
            if (!first) {
                break;
            }
            const [data, { resolve }] = first;
            let success = false;
            try {
                success = await emitter(data);
            } catch {
                success = false;
            }
            if (success) {
                lastOk = Date.now();
                await queue.shift();
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
        if (onData) {
            await onData(data);
        }
        const [result, awaiter] = createAwaiter<void>();
        await queue.push([data, awaiter]);
        await makeBroadcast();
        return await result;
    };

    makeBroadcast();

    wrappedFn.stop = handleStop;

    return wrappedFn;
};

export default pubsub;
