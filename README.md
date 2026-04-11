# 🛠️ functools-kit

> **A lightweight TypeScript utility library for async control flow, reactive programming, and functional helpers.**

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/tripolskypetr/functools-kit)
[![npm](https://img.shields.io/npm/v/functools-kit.svg?style=flat-square)](https://npmjs.org/package/functools-kit)

Build robust, production-grade applications with functools-kit! This library provides a comprehensive set of tools for async orchestration, memoization, reactive streams, and functional programming patterns. Whether you need debounced calls, cancellable promises, pub/sub messaging, or observable data streams — it's all here with a clean, type-safe API.

📚 **[Full Documentation](https://github.com/react-declarative/react-declarative/blob/master/docs/code/UTILS.md)**

---

## ✨ Why Choose functools-kit?

- ⚡ **Async Control Flow**: Rich set of async wrappers — `cancelable`, `queued`, `execpool`, `retry`, `lock`, `singlerun`, `afterinit` — for managing concurrent, sequential, and fault-tolerant async operations. 🔄

- 🔁 **Reactive Streams**: Full observer/subject pattern with `Observer`, `Subject`, `BehaviorSubject`, and operators like `map`, `filter`, `debounce`, `merge`, `join` — build reactive pipelines with ease. 📡

- 🧠 **Smart Caching**: `memoize`, `cached`, `ttl`, `router` — cache results by key, by argument change, or with time-to-live expiry. Per-key state routing prevents memory leaks. 🗂️

- 🛡️ **Error Resilience**: `trycatch`, `retry`, `obsolete`, `rate` — wrap functions with structured error handling, automatic retries, rate limiting, and deprecation warnings. 🚑

- 📦 **Pub/Sub Messaging**: `pubsub` with pluggable async queue and map adapters (`PubsubArrayAdapter`, `PubsubMapAdapter`) for building message-driven workflows with backpressure. 📨

- 🔢 **Pagination & Iteration**: `iterateDocuments`, `iterateUnion`, `iterateList`, `paginateDocuments`, `filterDocuments`, `mapDocuments` — async generator-based document iteration with offset/cursor pagination support. 📄

- 🧩 **Functional Helpers**: `compose`, `match`, `and`, `or`, `not`, `first`, `last`, `join`, `truely`, `str`, `has` — compose functions and work with arrays/strings in a functional style. 🧮

---

## 🚀 Getting Started

### Installation

```bash
npm install functools-kit
```

### Quick Examples

**Debounce & Throttle**

```typescript
import { debounce, throttle } from "functools-kit";

const onResize = debounce(() => recalcLayout(), 300);
const onScroll = throttle(() => updateHeader(), 100);
```

**Memoize with TTL**

```typescript
import { ttl } from "functools-kit";

const getUser = ttl(
  async (userId: string) => fetchUser(userId),
  { key: ([id]) => id, timeout: 60_000 }
);
```

**Cancelable Promises**

```typescript
import { cancelable, CANCELED_PROMISE_SYMBOL } from "functools-kit";

const fetchData = cancelable(async (url: string) => {
  const res = await fetch(url);
  return res.json();
});

const result = await fetchData("/api/data");
if (result === CANCELED_PROMISE_SYMBOL) return;

fetchData.cancel(); // cancel any in-flight call
```

**Observer / Reactive Stream**

```typescript
import { Subject } from "functools-kit";

const subject = new Subject<number>();

subject
  .filter(n => n % 2 === 0)
  .map(n => n * 2)
  .debounce(200)
  .connect(value => console.log(value));

subject.next(1);
subject.next(2); // logs 4
subject.next(4); // logs 8
```

**Operator: take, skip, distinct, group**

```typescript
import { Source, Operator } from "functools-kit";

Source.fromArray([1, 2, 3, 2, 1, 4, 5])
  .operator(Operator.distinct())        // remove duplicates: 1,2,3,4,5
  .operator(Operator.skip(1))           // skip first: 2,3,4,5
  .operator(Operator.take(3))           // take first 3: 2,3,4
  .connect(value => console.log(value));

Source.fromInterval(100)
  .operator(Operator.group(3))          // emit batches of 3: [0,1,2], [3,4,5]...
  .connect(batch => console.log(batch));
```

**Execution Pool**

```typescript
import { execpool } from "functools-kit";

const processFile = execpool(
  async (path: string) => heavyProcessing(path),
  { maxExec: 4, delay: 50 }
);

await Promise.all(files.map(f => processFile(f)));
```

**Lock: mutual exclusion for async code**

```typescript
import { Lock } from "functools-kit";

const lock = new Lock();

async function criticalSection() {
  await lock.acquireLock();
  try {
    // only one caller runs here at a time
    await writeToDatabase();
  } finally {
    await lock.releaseLock();
  }
}

// concurrent calls are serialized automatically
await Promise.all([criticalSection(), criticalSection(), criticalSection()]);
```

**Per-Key Router Cache**

```typescript
import { router } from "functools-kit";

const loadCamera = router<(cameraId: number, cacheKey: string) => Promise<void>, number>(
  ([cameraId]) => cameraId,
  ([, a], [, b]) => a !== b,
  async (cameraId, cacheKey) => { await processCamera(cameraId); }
);
```

---

## 🌟 Key Features

- ⚙️ **`singleshot` / `singlerun`**: Execute a function exactly once; reset with `.clear()`. 🔒
- 🔂 **`queued` / `lock`**: Serialize async calls — queue or mutex-style. 🚦
- 🕐 **`singletick`**: Coalesce multiple synchronous calls into one per event loop tick. ⏱️
- 📡 **`pubsub`**: Message queue with lifecycle hooks (`onBegin`, `onProcess`, `onEnd`, `onError`, `onDestroy`). 📬
- 🏗️ **`Source`**: Factory for observers — `createHot`, `createCold`, `fromPromise`, `fromInterval`, `fromSubject`, `pipe`, `merge`, `join`. 🔧
- 🎛️ **`Operator`**: Stream operators — `take`, `skip`, `distinct`, `group`, `pair`, `strideTricks`, `liveness`, `count`. 🎚️
- 🌐 **`fetchApi`**: Typed fetch wrapper with `FetchError` for structured HTTP error handling. 🌍
- 📐 **`ToolRegistry`**: Generic type-safe registry for runtime tool/plugin registration. 🗃️
- 📊 **`SortedArray` / `LimitedSet` / `LimitedMap`**: Specialized data structures with size and score constraints. 📦
- 🔐 **`Lock`**: Class-based mutual exclusion primitive — `acquireLock` / `releaseLock` with mis-matched release detection. 🧱

---

## 📖 API Reference

### Async HOFs

| Function | Description |
|---|---|
| `cancelable` | Wraps a promise with cancellation support |
| `queued` | Serializes calls into a promise queue |
| `execpool` | Limits concurrent async executions |
| `retry` | Retries on failure with configurable count/delay |
| `lock` | Mutex for async functions |
| `singlerun` | Runs only once until cleared |
| `afterinit` | Skips calls until first run completes |
| `schedule` | Defers execution with a scheduler callback |
| `obsolete` | Marks a function as deprecated |
| `timeout` | Wraps with a timeout, returns `TIMEOUT_SYMBOL` on expiry |

### Caching

| Function | Description |
|---|---|
| `memoize` | Cache by key function |
| `cached` | Cache by argument change detection |
| `ttl` | Time-to-live cache with optional GC |
| `router` | Per-key cached memoization |
| `rate` | Rate limiting by key |

### Reactive

| Class / Function | Description |
|---|---|
| `Observer` | Full observable implementation |
| `Subject` | Observable + subscriber |
| `BehaviorSubject` | Subject with current value |
| `Source` | Observer factory methods |
| `Operator` | Stream transformation operators |
| `waitForNext` | Await a subject value matching a condition |

### Utilities

| Function | Description |
|---|---|
| `debounce` / `throttle` | Rate-limit function calls |
| `singletick` | One execution per event loop tick |
| `compose` | Right-to-left function composition |
| `trycatch` | Try-catch wrapper with fallback |
| `sleep` | Promise-based delay |
| `createAwaiter` | Create a promise with external resolve/reject |
| `deepFlat` | Deep-flatten nested arrays |
| `singleshot` | Run once with memoized result |

### Data Structures

| Class | Description |
|---|---|
| `Lock` | Class-based mutex: `acquireLock` / `releaseLock`, throws on extra release |
| `SortedArray` | Array sorted by numeric score with `push`, `pop`, `take` |
| `LimitedSet` | `Set` capped at a max size |
| `LimitedMap` | `Map` capped at a max size |
| `ToolRegistry` | Type-safe runtime registry with `register` / `get` |

### String & Array

| Function | Description |
|---|---|
| `str` | Join strings with separators (space, comma, newline, etc.) |
| `join` | Merge arrays, dedup and strip nulls |
| `split` | Split string arrays |
| `truely` | Filter nulls from array |
| `first` / `last` | Safe first/last element |
| `has` | Membership check for Array/Set/Map |
| `formatText` | Format string by template mask |
| `compareFulltext` | Fulltext match against object fields |
| `typo` | Typography constants (nbsp, emdash, etc.) |

---

## 🎯 Use Cases

- ⚙️ **Backend Services**: Rate-limit external API calls, pool database queries, cache expensive computations. 🖥️
- 📡 **Event-Driven Systems**: Build reactive pipelines with subjects and observers instead of raw event emitters. 🔁
- 📄 **Data Pipelines**: Iterate millions of documents via async generators with filtering, mapping, and pagination. 📊
- 💬 **Real-Time Apps**: Use `pubsub` for message queuing, `BehaviorSubject` for state sync. 🌐
- 🤖 **AI Agent Backends**: Used internally by [`agent-swarm-kit`](https://github.com/tripolskypetr/agent-swarm-kit) for TTL caching, randomString, str utilities, and observable coordination. 🧠

---

## 🌍 Ecosystem

functools-kit is used as a core dependency in:

- **[backtest-kit](https://github.com/tripolskypetr/backtest-kit)** — TypeScript framework for backtesting trading strategies with clean architecture and real-time execution capabilities.
- **[agent-swarm-kit](https://github.com/tripolskypetr/agent-swarm-kit)** — Multi-agent AI orchestration framework
- **[react-declarative](https://github.com/react-declarative/react-declarative)** — Declarative React application framework

---

## 🧪 Test Coverage

The library ships with **515 tests** covering both correctness and async exception propagation.

### Spec tests — functional correctness

| Module | Tests |
|---|---|
| `EventEmitter` | subscribe/unsubscribe, once, emit order, hasListeners |
| `Observer` | map, filter, tap, reduce, flatMap, split, mapAsync, merge, once, toPromise, debounce, delay, repeat, connect/unsubscribe |
| `Subject` | next, subscribe, unsubscribeAll, once, map, filter, toObserver, toPromise |
| `BehaviorSubject` | initial value replay, late subscriber, subscribe vs toObserver |
| `Source` | fromValue, fromArray, fromPromise, fromDelay, fromInterval, createHot, createCold, merge, join, fromSubject, fromBehaviorSubject, unicast, multicast, pipe |
| `Operator` | take, skip, pair, group, distinct, count, strideTricks, retry |
| `awaiter` | sync/async resolve and reject, argument passthrough |
| `afterinit` | skips first call, runs subsequent |
| `cached` | hit/miss, argument change detection |
| `cancelable` | cancels in-flight, CANCELED_PROMISE_SYMBOL |
| `debounce` | fires last value after quiet period |
| `execpool` | resolve, concurrent limit, reject propagation |
| `lock` | serialization, extra release throws |
| `memoize` | key function caching |
| `obsolete` | deprecation warning passthrough |
| `pubsub` | commit, retry on false, stop, onBegin/onEnd hooks |
| `queued` | sequential ordering |
| `rate` | rate limiting by key |
| `retry` | retries N times then throws |
| `router` | per-key cache, invalidation |
| `schedule` | deferred execution |
| `singlerun` | once until clear |
| `singleshot` | once with memoized result |
| `singletick` | coalesces per tick |
| `throttle` | leading-edge rate limit |
| `timeout` | TIMEOUT_SYMBOL on expiry |
| `trycatch` | sync/async throw and fallback |
| `ttl` | time-to-live expiry |
| `waitForNext` | condition match, timeout, no-delay |

### E2E tests — async exception propagation

| Scope | What is verified |
|---|---|
| `Subject` | `await subject.next()` propagates async subscriber throws |
| `Observer` operators | Every operator (`map`, `filter`, `tap`, `reduce`, `flatMap`, `split`, `merge`, `debounce`, `repeat`, `mapAsync`, `delay`) propagates throws through the chain |
| Operator chains | Multi-step chains (`filter→map`, `map→tap→filter`, `flatMap→filter`, `merge→filter`, deep 4-level chains) propagate throws end-to-end |
| `Operator` library | `take`, `skip`, `pair`, `group`, `distinct`, `count`, `strideTricks`, `retry` — all propagate throws; `retry` exhausts attempts before throwing |
| `Source.fromArray` | Async throw in `connect` propagates; async throw via `toPromise` propagates |
| `Source.fromPromise` | `callbackfn` reject propagates via `toPromise`; async throw in `connect` propagates; async throw via `toPromise` propagates |
| `Source.fromDelay` | Async throw in `connect` and via `toPromise` propagates |
| `Source.fromInterval` | Async throw in `connect` and via `toPromise` propagates |
| `execpool` | Reject propagates to direct caller; reject propagates to queued caller |
| `pubsub` | Emitter throw treated as failure and retried; `onError` callback invoked with data and error |
| `waitForNext` | Timeout resolves to `TIMEOUT_SYMBOL` without throwing |

### Spec tests — integration chain throw propagation

All tests use `.toPromise()` + `try/catch` — no `throws()` helper, no side-channel assertions.

| Suite | What is verified |
|---|---|
| `integration-chain-throws` | 40 Subject-based and Source-based pipelines: `filter→map`, `mapAsync→distinct→take`, `group→mapAsync→tap`, `skip→group→connect`, ETL, ML feature pipelines, IoT, event-sourcing, auth/user flows — sync and async throws at every operator position |
| `integration-chain-throws-scoped` | Same 40 pipelines repeated with `process.on("unhandledRejection")` and `process.on("error")` guards per test — verifies no unhandled rejections leak out of any chain |
| `from-chain-throws` | `fromArray`, `fromPromise`, `fromValue`, `fromDelay`, `fromInterval` each chained with `map`, `mapAsync`, `tap`, `filter` — throw propagates via `toPromise` |
| `fromDelay-fromInterval-throws` | `fromDelay` and `fromInterval` with multi-hop chains including `mapAsync` and `tap` — async throw propagates |
| `error-propagation-extra` | `merge`, `flatMap`, `split`, `reduce`, `repeat`, `retry`, `operator(distinct/skip/take/pair/group/count/strideTricks)` — error propagation via `toPromise`; `once()` basic behavior; two independent subjects reject independently |

## 🤝 Contribute

Fork the repo, submit a PR, or open an issue on **[GitHub](https://github.com/tripolskypetr/functools-kit)**. 🙌

## 📜 License

MIT © [tripolskypetr](https://github.com/tripolskypetr) 🖋️
