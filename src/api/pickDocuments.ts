/**
 * A function that picks a subset of documents from an array of documents, given a limit and offset.
 *
 * @template T - The type of the documents in the array.
 * @param limit - The maximum number of documents to pick.
 * @param offset - The number of documents to skip before picking.
 * @returns - A function that takes an array of documents and returns an object with `rows` and `done` properties.
 *                       The `rows` property contains the picked documents, and `done` property indicates if the picking is finished.
 */
export const pickDocuments = <T extends any>(
  limit: number,
  offset: number
) => {
  const result: T[] = [];
  return (rows: T[] = []) => {
    for (const row of rows) {
      if (offset > 0) {
        offset -= 1;
        continue;
      }
      if (limit > 0) {
        result.push(row);
        limit -= 1;
        continue;
      }
      break;
    }
    return {
      // copy: returning the live internal array let callers observe later
      // mutations and corrupt picker state by pushing into it
      rows: [...result],
      done: limit <= 0,
    };
  };
};

export default pickDocuments;
