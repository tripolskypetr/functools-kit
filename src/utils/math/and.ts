type Value = number | boolean;

/**
 * Performs a logical AND operation on multiple values.
 *
 * @template T - The type of the values
 * @param args - The values to perform the logical AND operation on
 * @returns - The result of the logical AND operation
 */
// thenables must take the async path too: `instanceof Promise` missed them,
// so the thenable object itself (always truthy) hit the boolean reduce
const isThenable = (arg: any): boolean =>
    arg instanceof Promise || Boolean(arg && typeof arg.then === "function");

export const and = <T = Promise<Value>>(...args: T[]): T => {
    if (args.some(isThenable)) {
        return new Promise<boolean>(async (res, rej) => {
            try {
                const items = await Promise.all(args);
                const result = items.reduce<boolean>((acm, cur) => Boolean(acm && cur), true);
                res(result);
            } catch (error) {
                rej(error);
            }
        }) as unknown as T;
    }
    return args.reduce<boolean>((acm, cur) => Boolean(acm && cur), true) as unknown as T;
}

export default and;
