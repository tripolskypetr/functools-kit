export const TIMEOUT_SYMBOL = Symbol('timeout');

declare var setTimeout: any;
declare var clearTimeout: any;

export const timeout = <T extends any = any, P extends any[] = any[]>(
  run: (...args: P) => Promise<T>,
  delay = 30_000
) => {
  const wrappedFn = async (...args: P) => {
    // the timer must be cancelled when run settles first, otherwise every
    // call keeps the event loop alive for the full delay
    let timer: ReturnType<typeof setTimeout>;
    const timerPromise = new Promise<typeof TIMEOUT_SYMBOL>((resolve) => {
      timer = setTimeout(() => resolve(TIMEOUT_SYMBOL), delay);
    });
    try {
      return await Promise.race([
        run(...args as P),
        timerPromise,
      ]);
    } finally {
      clearTimeout(timer!);
    }
  };

  return wrappedFn;
};

export default timeout;
