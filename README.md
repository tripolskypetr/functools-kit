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
import { Subject, Source, Operator } from "functools-kit";

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

**Execution Pool**

```typescript
import { execpool } from "functools-kit";

const processFile = execpool(
  async (path: string) => heavyProcessing(path),
  { maxExec: 4, delay: 50 }
);

await Promise.all(files.map(f => processFile(f)));
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
- 📡 **`pubsub`**: Message queue with lifecycle hooks (`onBegin`, `onProcess`, `onEnd`, `onDestroy`). 📬
- 🏗️ **`Source`**: Factory for observers — `createHot`, `createCold`, `fromPromise`, `fromInterval`, `fromSubject`, `pipe`, `merge`, `join`. 🔧
- 🎛️ **`Operator`**: Stream operators — `take`, `skip`, `distinct`, `group`, `pair`, `strideTricks`, `liveness`, `count`. 🎚️
- 🌐 **`fetchApi`**: Typed fetch wrapper with `FetchError` for structured HTTP error handling. 🌍
- 📐 **`ToolRegistry`**: Generic type-safe registry for runtime tool/plugin registration. 🗃️
- 📊 **`SortedArray` / `LimitedSet` / `LimitedMap`**: Specialized data structures with size and score constraints. 📦

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

- **[agent-swarm-kit](https://github.com/tripolskypetr/agent-swarm-kit)** — Multi-agent AI orchestration framework
- **[react-declarative](https://github.com/react-declarative/react-declarative)** — Declarative React application framework

---

## 🤝 Contribute

Fork the repo, submit a PR, or open an issue on **[GitHub](https://github.com/tripolskypetr/functools-kit)**. 🙌

## 📜 License

MIT © [tripolskypetr](https://github.com/tripolskypetr) 🖋️
