import join from "./join";

const SPLIT_CHARS = ["_", "-", " "];

export const split = (
  ...arr: (string | string[] | null)[] | (string | string[] | null)[][]
): string[] => {
  return join(...arr)
    .flatMap((c) => c)
    .flatMap((c) => SPLIT_CHARS.reduce<string[]>(
      (parts, separator) => parts.flatMap((part) => part.split(separator)),
      [c],
    ).map((part) => part.toLowerCase()));
};

export default split;
