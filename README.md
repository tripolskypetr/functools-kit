# func-kit

> A library with helpers for [react-declarative](https://github.com/react-declarative/react-declarative) app backend development

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/tripolskypetr/functools-kit)
[![npm](https://img.shields.io/npm/v/functools-kit.svg?style=flat-square)](https://npmjs.org/package/functools-kit)

## What inside

The complete description is available [by this link](https://github.com/react-declarative/react-declarative/blob/master/docs/code/UTILS.md). This npm module exports the following TypeScript definitions:
 
1. **Utility Functions** : 

  - `randomString`: Generates a random string using UUID.
 
  - `compareFulltext<T>`: Compares a search term against a data object.
 
  - `compareArray`: Checks if two arrays are equal.
 
  - `isObject`: Verifies if a value is an object.
 
  - `formatText`: Formats a string based on a template with customizable options.
 
  - `singleshot` and `singlerun`: Functions that run once and allow clearing/resetting.
 
  - `debounce`: Creates a debounced version of a function.
 
  - `retry`: Retries a function multiple times until it succeeds.
 
  - `deepFlat`: Deep flattens an array.
 
  - `memoize`: Caches function results based on argument changes.
 
  - `trycatch`: Wraps a function with a try-catch block.
 
  - `sleep`: Delays execution by a specified time.
 
  - `cancelable`, `queued`, `execpool`: Wrappers for promise-based functions with enhanced functionality like cancellation and concurrency control.
 
  - `createAwaiter`: Creates an awaitable promise and returns resolve and reject out of the closure.
 
2. **Interfaces and Types** : 

  - `IParams`, `IClearable`, `ITaskStatus`, `ICounted`, `IError`, and various `IWrappedFn` types for defining functionalities related to tasks, observers, and clearing mechanisms.
 
  - `TObserver`, `TSubject`, `TObservable`, `TBehaviorSubject`: Types representing observer and subject patterns for handling observable data streams.
 
3. **Classes** : 

  - `Task`: Represents a task with status tracking.
 
  - `Observer`, `Subject`, `BehaviorSubject`: Classes implementing observer/observable patterns.
 
  - `EventEmitter`: Provides event management capabilities.
 
  - `Operator`, `Source`: Utility classes for creating and manipulating observers.
 
4. **Constants** : 

  - `CANCELED_PROMISE_SYMBOL`: A unique symbol representing cancellation status.
