import join from "./join";

const SPLIT_CHARS = ["_", "-", " "];

export const split = (
  ...arr: (string | string[] | null)[] | (string | string[] | null)[][]
): string[] => {
  return join(...arr)
    .flatMap((c) => c)
    .flatMap((c) => {
      const separator = SPLIT_CHARS.find((s) => c.includes(s));
      if (separator) {
        return c.split(separator).map((c) => c.toLowerCase());
      }
      return c.toLowerCase();
    });
};

export default split;
