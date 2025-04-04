type Function = () => void;

/**
 * Interface representing an object that can be cleared and flushed.
 */
export interface IDebounceClearable {
    clear: () => void;
    flush: () => void;
    pending: () => boolean;
}

const REQUEST_ANIMATION_FRAME_FN = "requestAnimationFrame" in globalThis ? globalThis.requestAnimationFrame : setTimeout;
const CANCEL_ANIMATION_FRAME_FN = "cancelAnimationFrame" in globalThis ? globalThis.cancelAnimationFrame : clearTimeout;

const REQUEST_ANIMATION_FRAME = (fn: Function) => REQUEST_ANIMATION_FRAME_FN(fn);
const CANCEL_ANIMATION_FRAME = (id: ReturnType<typeof CANCEL_ANIMATION_FRAME_FN>) => CANCEL_ANIMATION_FRAME_FN(id);

/**
 * Creates a debounced version of a function.
 *
 * @template T - The type of the original function.
 * @param run - The function to debounce.
 * @param [delay=1000] - The delay in milliseconds before executing the debounced function.
 * @returns - The debounced function with additional methods for clearing and flushing.
 */
export const debounce = <T extends (...args: any[]) => any>(run: T, delay = 1_000): T & IDebounceClearable => {
    let timeout: any;
    let lastRun: Function | null = null;

    const on = delay ? setTimeout : REQUEST_ANIMATION_FRAME;
    const un = delay ? clearTimeout : CANCEL_ANIMATION_FRAME;
  
    /**
     * Wrapper function that delays the execution of a given function
     *
     * @param run - The function to be executed
     * @param delay - The delay in milliseconds
     * @returns
     */
    const wrappedFn = (...args: any[]) => {
      timeout !== null && un(timeout);
      const exec = () => {
        lastRun = null;
        timeout = null;
        run(...args);
      };
      lastRun = exec;
      timeout = on(exec, delay);
    };

    /**
     * Clears the wrapped function from any saved state or implementation.
     *
     * @memberof wrappedFn
     */
    wrappedFn.clear = () => {
      timeout !== null && un(timeout);
      timeout = null;
      lastRun = null;
    };

    /**
     * Flushes any queued functions within the wrapped function.
     *
     * @param wrappedFn - The wrapped function that may have queued functions.
     * @returns
     */
    wrappedFn.flush = () => {
      timeout !== null && un(timeout);
      lastRun && lastRun();
      timeout = null;
      lastRun = null;
    };

    wrappedFn.pending = () => {
      return !!lastRun;
    };

    return wrappedFn as T & IDebounceClearable;
};

export default debounce;
