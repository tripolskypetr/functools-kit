import { TObserver } from "../Observer";

/**
 * Applies stride tricks to a given target observer.
 * @template T The type of elements in the target observer.
 * @param strideSize The size of each stride.
 * @param [step=Math.floor(strideSize / 2)] The step size between each stride.
 * @returns The transformed observer that emits strided data.
 * @throws If the strideSize or step is too big, or if the data is unshaped.
 */
export const strideTricks = <T = any>(strideSize: number, step = Math.floor(strideSize / 2)) => (target: TObserver<T[]>): TObserver<T[][]> => {
  let windowSize = -1;
  let totalSteps = -1;
  let resultSize = -1;
  let needExtraStep = false;
  return target
    .tap((buffer) => {
      if (windowSize !== -1) {
        return;
      }
      // validate before caching state, otherwise an invalid config throws
      // once and silently emits corrupt windows afterwards
      if (strideSize > buffer.length || step > strideSize) throw new Error('rn-declarative strideTricks too big stride');
      // step <= 0 (incl. the default floor(1/2)=0 for strideSize=1) makes
      // totalSteps Infinity/negative and the window loop below never
      // terminates — the process hangs in a synchronous loop until OOM
      if (!Number.isInteger(strideSize) || strideSize <= 0 || !Number.isInteger(step) || step <= 0) throw new Error('rn-declarative strideTricks invalid stride config');
      windowSize = buffer.length;
      // window count is floor((w - s) / step) + 1; the tail stride is needed
      // exactly when those windows do not end at the last element
      totalSteps = Math.floor((windowSize - strideSize) / step) + 1;
      needExtraStep = (totalSteps - 1) * step + strideSize !== windowSize;
      resultSize = totalSteps + (needExtraStep ? 1 : 0);
    })
    .flatMap((buffer) => {

      if (buffer.length !== windowSize) {
        throw new Error('rn-declarative strideTricks unshaped data');
      }

      const strides: T[][] = [];

      for (let i = 0; i !== totalSteps; i++) {
        const startPos = i * step;
        strides.push(
          buffer.slice(startPos, startPos + strideSize)
        );
      }

      if (needExtraStep) {
        const lastStep = buffer.slice(windowSize - strideSize, windowSize);
        lastStep["lastStep"] = true;
        strides.push(lastStep);
      }

      return strides.flat(1);
    })
    .reduce<T[]>((acm, cur) => {
      if (acm.length === strideSize) {
        return [cur];
      } else {
        return [...acm, cur];
      }
    }, [])
    .filter((acm) => acm.length === strideSize)
    .reduce<T[][]>((acm, cur) => {
      if (acm.length === resultSize) {
        return [cur];
      } else {
        return [...acm, cur];
      }
    }, [])
    .filter((acm) => acm.length === resultSize)
};

export default strideTricks;
