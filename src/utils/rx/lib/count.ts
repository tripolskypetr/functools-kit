import type TObserver from "../../../model/TObserver";

const NEVER_VALUE = Symbol('never');

export interface ICounted<T> {
  value: T;
  count: number;
}

/**
 * Counts consecutive occurrences of each value emitted by the target observer.
 * The first occurrence of a value emits `count: 1`, each consecutive repeat
 * increments the count; a different value resets the count back to 1.
 *
 * @template T - The type of values emitted by the target observer.
 * @param target - The target observer to count the occurrences for.
 * @returns - An observer that emits {@link ICounted} objects containing the value and count.
 */
export const count = <T = any>() => (target: TObserver<T>): TObserver<ICounted<T>> => {
  return target
  .reduce<{
    value: T;
    count: number;
  }>((acm, cur) => {
    if (acm.value === cur) {
      return {
        value: cur,
        count: acm.count + 1,
      };
    }
    return {
      value: cur,
      count: 1,
    };
  }, {
    value: NEVER_VALUE as never,
    count: 0,
  })
};

export default count;
