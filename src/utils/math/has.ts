export const has = <T = unknown>(
  arr: T | T[] | Set<T> | Map<T, unknown> | null | undefined,
  ...value: T[]
) => {
  if (Array.isArray(arr)) {
    return value.some((v) => arr.includes(v));
  }
  if (arr instanceof Set) {
    return value.some((v) => arr.has(v));
  }
  if (arr instanceof Map) {
    return value.some((v) => arr.has(v));
  }
  // exclude only null/undefined: a truthiness check made falsy scalars
  // (0, "", false) unmatchable — has(0, 0) returned false
  if (arr !== null && arr !== undefined) {
    return value.some((v) => arr === v);
  }
  return false;
};

export default has;
