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
    if (argsLast) {
      await onSchedule(argsLast);
    }
    argsLast = args;
  });

  const waitForSchedule = singlerun(async () => {
    while (true) {
      if (executeFn.getStatus() !== "pending") {
        break;
      }
      if (!argsLast) {
        return null;
      }
      await sleep(delay);
    }
    const args = argsLast;
    argsLast = null;
    return await executeFn(...args);
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
