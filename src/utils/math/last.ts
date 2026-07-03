/**
 * Returns the last element of an array or null if the array is empty or not an array.
 *
 * @param arr - The array from which to retrieve the last element.
 * @returns - The last element of the array or null.
 */
export const last = <T = any>(arr: T[] | null | undefined): T | null => {
    if (Array.isArray(arr)) {
        return arr.length ? arr[arr.length - 1] : null;
    }
    return null;
}

export default last;
