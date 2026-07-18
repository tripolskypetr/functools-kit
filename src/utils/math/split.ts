import join from "./join";

const SPLIT_CHARS = ["_", "-", " "];

export const split = (
  ...arr: (string | string[] | null)[] | (string | string[] | null)[][]
): string[] => {
  const tokens = join(...arr)
    .flatMap((c) => c)
    .flatMap((c) => SPLIT_CHARS.reduce<string[]>(
      (parts, separator) => parts.flatMap((part) => part.split(separator)),
      [c],
    ).map((part) => part.toLowerCase()))
    // adjacent/leading/trailing separators produce empty fragments
    .filter((part) => part !== "");
  // dedupe AFTER lowercasing/splitting: join() only dedupes raw inputs, so
  // case variants and reordered compound tokens produced duplicates
  return [...new Set(tokens)];
};

export default split;
