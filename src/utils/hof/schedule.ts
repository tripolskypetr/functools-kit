import sleep from "../sleep";
import queued from "./queued";
import singlerun from "./singlerun";

const COMMIT_CHECK_DELAY = 1_000;

export interface IScheduleParams<P extends any[]> {
  onSchedule: (args: P) => Promise<void>;
  delay?: number;
}

export interface IWrappedScheduleFn<T extends any = any, P extends any[] = any> {
    (...args: P): Promise<T | null>;
    clear(): void;
};

export const schedule = <T extends any = any, P extends any[] = any[]>(
  run: (...args: P) => Promise<T>,
  { onSchedule, delay = COMMIT_CHECK_DELAY }: IScheduleParams<P>
): IWrappedScheduleFn<T, P> => {

  const executeFn = singlerun(run);
  let argsLast: P | null = null;

  const commitQueue = queued(async (args: P) => {
    // commit the new args BEFORE notifying: a throwing onSchedule must not
    // silently drop the freshly scheduled call
    const prevArgs = argsLast;
    argsLast = args;
    if (prevArgs) {
      await onSchedule(prevArgs);
    }
  });

  const waitForSchedule = singlerun(async () => {
    let lastResult: T | null = null;
    let hasResult = false;
    while (true) {
      while (executeFn.getStatus() === "pending") {
        await sleep(delay);
      }
      if (!argsLast) {
        // args committed while a scheduled run was executing are drained
        // here instead of being silently dropped
        return hasResult ? lastResult : null;
      }
      const args = argsLast;
      argsLast = null;
      lastResult = await executeFn(...args);
      hasResult = true;
    }
  });

  const wrappedFn = async (...args: P): Promise<T | null> => {
    if (executeFn.getStatus() === "pending") {
      await commitQueue(args);
      return await waitForSchedule();
    }
    return await executeFn(...args);
  };

  wrappedFn.clear = () => {
    argsLast = null;
  };

  return wrappedFn;
};

export default schedule;
