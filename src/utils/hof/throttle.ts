/**
 * Represents an interface for objects that can be cleared.
 */
export interface IClearableThrottle {
    clear: () => void;
}

/**
 * Throttle function execution to a specific delay.
 * @template T - Function type
 * @param run - Function to be throttled
 * @param delay - Delay in milliseconds (default: 1000)
 * @returns - Throttled function with clear method
 */
export const throttle = <T extends (...args: any[]) => any>(run: T, delay = 1_000): T & IClearableThrottle => {
	let timeoutID: any;
	let lastExec = 0;
	/**
	 * Clears the existing timeout.
	 *
	 * @function
	 * @name clearExistingTimeout
	 * @returns
	 */
	const clearExistingTimeout = () => {
		if (timeoutID) {
			clearTimeout(timeoutID);
		}
	};
	/**
	 * A wrapper function that delays the execution of the given function
	 * until a certain amount of time has passed since the last execution.
	 *
	 * @param args - Arguments to be passed to the wrapped function.
	 * @returns
	 */
	const wrappedFn = (...args: any[]) => {
		let elapsed = Date.now() - lastExec;
		const exec = () => {
			lastExec = Date.now();
			const result = run(...args) as any;
			// rejections on both leading and trailing edges have no awaiting
			// caller — keep them off the unhandled queue
			if (result && result instanceof Promise) {
				result.catch((e: unknown) => console.error("functools-kit throttle uncaught rejection", e));
			}
		};
		clearExistingTimeout();
		timeoutID = null;
		if (elapsed > delay) {
			exec();
			return;
		}
		timeoutID = setTimeout(() => {
			timeoutID = null;
			exec();
		}, delay - elapsed);
	};
	/**
	 * Clears the wrapped function.
	 * This function removes any existing functionality from the wrapped function.
	 *
	 * @memberof wrappedFn
	 * @function clear
	 */
	wrappedFn.clear = () => {
		clearExistingTimeout();
		timeoutID = null;
	};
    return wrappedFn as T & IClearableThrottle;
};

export default throttle;
