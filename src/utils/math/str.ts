import join from "./join";

/**
 * Joins an array of strings or arrays of strings into a single string, with each element separated by a space.
 * It also handles cases where the input is null or nested arrays.
 */
export const str = (...arr: (number | string | string[] | null)[] | (number | string | string[] | null)[][]): string => {
    return join(...arr).join(" ");
};

export default str;
