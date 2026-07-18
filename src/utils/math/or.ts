type Value = number | boolean;

/**
 * Returns a value of type T representing the logical OR operation on the given arguments.
 *
 * @param args - The arguments to be evaluated for the logical OR operation.
 * @returns A value of type T representing the result of the logical OR operation.
 * @throws If any of the arguments is a rejected promise.
 * @typeparam T - The type of the arguments and the return value.
 */
// thenables must take the async path too: `instanceof Promise` missed them,
// so the thenable object itself (always truthy) hit the boolean reduce
const isThenable = (arg: any): boolean =>
    arg instanceof Promise || Boolean(arg && typeof arg.then === "function");

export const or = <T = Promise<Value>>(...args: T[]): T => {
    if (args.some(isThenable)) {
        return new Promise<boolean>(async (res, rej) => {
            try {
                const items = await Promise.all(args);
                const result = items.reduce<boolean>((acm, cur) => Boolean(acm || cur), false);
                res(result);
            } catch (error) {
                rej(error);
            }
        }) as unknown as T;
    }
    return args.reduce<boolean>((acm, cur) => Boolean(acm || cur), false) as unknown as T;
}

export default or;
