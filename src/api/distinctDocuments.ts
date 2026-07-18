import IRowData, { RowId } from "../model/IRowData";

/**
 * Resolves the documents from an async generator and distincts them.
 *
 * @param iterator - The async generator to resolve documents from.
 * @returns - A promise that resolves to the flattened array of documents.
 */
export async function* distinctDocuments<Data = IRowData>(
    iterator: AsyncGenerator<Data | Data[], void, unknown>,
    getId = (data: Data) => data["id"],
){
    const duplicateSet = new Set<RowId>();
    for await (const chunk of iterator) {
        const rows = [chunk].flatMap(v => v);
        for (const row of rows) {
            const id = getId(row);
            // rows without an id must pass through: undefined is a single
            // Set key, so they were all collapsed into the first one
            if (id === undefined) {
                yield row;
                continue;
            }
            if (!duplicateSet.has(id)) {
                duplicateSet.add(id);
                yield row;
            }
        }
    }
};

export default distinctDocuments;
