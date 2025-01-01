import createAwaiter, { IAwaiter } from "../createAwaiter";

import singleshot from "./singleshot";
import singlerun from "./singlerun";
import sleep from "../sleep";

import randomString from "../randomString";

const PUBSUB_TIMEOUT = 30_000;

export interface IPubsubConfig<Data = any> {
    onDestroy?: (queue: IPubsubArray<[string, Data]>) => (Promise<void> | void);
    onBegin?: (data: Data) => (Promise<void> | void);
    onProcess?: (data: Data) => (Promise<void> | void);
    onEnd?: (data: Data) => (Promise<void> | void);
    queue?: IPubsubArray<[string, Data]>;
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
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export interface IPubsubMap<T = any> {
    clear(): Promise<void>;
    getFirst(): Promise<[string, T] | null>;
    size(): Promise<number>;
    set(key: string, value: T): Promise<void>;
    get(key: string): Promise<T | null>;
    delete(key: string): Promise<void>;
    shift(): Promise<[string, T] | null>;
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, T]>;
}

export class PubsubArrayAdapter<T = any> implements IPubsubArray<T> {

    private _array: T[] = [];

    constructor(private readonly _maxItems: number = Number.POSITIVE_INFINITY) { }

    length = () => Promise.resolve(this._array.length);

    push = async (value: T) => {
        this._array.push(value);
        while (await this.length() > this._maxItems) {
            this._array.shift();
        }
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

    async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
        for (const item of this._array) {
            yield item;
        }
    };
}

export class PubsubMapAdapter<T = any> implements IPubsubMap<T> {

    private _map: Map<string, T> = new Map();

    clear(): Promise<void> {
        this._map.clear();
        return Promise.resolve();
    }

    getFirst(): Promise<[string, T] | null> {
        const iterator = this._map.entries();
        const first = iterator.next();
        return Promise.resolve(first.done ? null : first.value);
    }

    size(): Promise<number> {
        return Promise.resolve(this._map.size);
    }

    set(key: string, value: T): Promise<void> {
        this._map.set(key, value);
        return Promise.resolve();
    }

    get(key: string): Promise<T | null> {
        const value = this._map.get(key) ?? null;
        return Promise.resolve(value);
    }

    delete(key: string): Promise<void> {
        this._map.delete(key);
        return Promise.resolve();
    }

    shift(): Promise<[string, T] | null> {
        const iterator = this._map.entries();
        const first = iterator.next();
        if (first.done) {
            return Promise.resolve(null);
        }
        this._map.delete(first.value[0]);
        return Promise.resolve(first.value);
    }

    async *[Symbol.asyncIterator](): AsyncIterableIterator<[string, T]> {
        for (const entry of this._map.entries()) {
            yield entry;
        }
    }
}

export const pubsub = <Data = any>(emitter: (data: Data) => Promise<boolean>, {
    onDestroy,
    onBegin,
    onProcess,
    onEnd,
    timeout = PUBSUB_TIMEOUT,
    queue: initialQueue = new PubsubArrayAdapter(),
}: Partial<IPubsubConfig<Data>> = {}) => {

    const awaiterMap = new Map<string, IAwaiter<void>>();

    const queue = initialQueue;
    let lastOk = Date.now();

    let isStopped = false;

    const handleStop = async () => {
        if (isStopped) {
            return;
        }
        isStopped = true;
        if (onDestroy) {
            await onDestroy(queue);
        }
        await queue.clear();
        awaiterMap.clear();
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
            const [id, data] = first;
            const awaiter = awaiterMap.get(id);
            if (!awaiter) {
                console.error("functools-kit pubsub missing awaiter", { id, data });
                continue;
            }
            let success = false;
            try {
                success = await emitter(data);
            } catch {
                success = false;
            } finally {
                await sleep(10);
            }
            if (success && onEnd) {
                await onEnd(data);
            }
            if (success) {
                lastOk = Date.now();
                await queue.shift();
                awaiterMap.delete(id);
                awaiter.resolve();
                continue;
            }
            await sleep(1_000);
            if (Date.now() - lastOk >= timeout) {
                await handleStop();
                return;
            }
        }
    });

    const makeCommit = async (data: Data) => {
        if (onBegin) {
            await onBegin(data);
        }
        const [result, awaiter] = createAwaiter<void>();
        const id = randomString();
        awaiterMap.set(id, awaiter);
        await queue.push([id, data]);
        if (onProcess) {
            await onProcess(data);
        }
        await makeBroadcast();
        return await result;
    };

    const makeInit = singleshot(async () => {
        const resolveList: Promise<void>[] = [];
        for await (const [id] of queue) {
            const [resolve, awaiter] = createAwaiter<void>();
            awaiterMap.set(id, awaiter);
            resolveList.push(resolve);
        } 
        await makeBroadcast();
        await Promise.all(resolveList);
    });

    const wrappedFn = async (data: Data) => {
        if (isStopped) {
            return;
        }
        await makeInit();
        await makeCommit(data);
    };

    wrappedFn.stop = handleStop;

    return wrappedFn;
};

pubsub.fromMap = <Data = any>(map: IPubsubMap<Data>) => new class implements IPubsubArray<[string, Data]> {
    clear = async () => await map.clear();
    getFirst = async () => await map.getFirst();
    length = async () => await map.size();
    push = async ([key, value]: [string, Data]) => await map.set(key, value);
    shift = async () => await map.shift();
    async *[Symbol.asyncIterator](): AsyncIterableIterator<[string, Data]> {
      for await (const entry of map) {
        yield entry;
      }
    }
};

export default pubsub;
