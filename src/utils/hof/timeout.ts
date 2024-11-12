import sleep from "../sleep";

export const TIMEOUT_SYMBOL = Symbol('timeout');

export const timeout = <T extends (...args: any[]) => any>(
  run: T,
  delay = 30_000
): T => {
  const wrappedFn = async (...args: any[]) => {
    const result = await Promise.race([
      run(...args),
      sleep(delay).then(() => TIMEOUT_SYMBOL),
    ]);
    return result;
  };

  return wrappedFn as unknown as T;
};

export default timeout;
