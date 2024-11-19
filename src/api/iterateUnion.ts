import IRowData, { RowId } from "../model/IRowData";

export const iterateUnion = <Data = IRowData>(iterators: AsyncGenerator<Data | Data[], void, unknown>[], getId = (data: Data) => data["id"]) =>
    async function* (limit: number, offset: number) {
        const duplicateSet = new Set<RowId>();
        for (const iterator of iterators) {
            for await (const chunk of iterator) {
                const rows = [chunk].flatMap(v => v);
                for (const row of rows) {
                    const id = getId(row);
                    if (duplicateSet.has(id)) {
                        continue;
                    }
                    if (offset > 0) {
                        offset -= 1;
                        continue;
                    }
                    if (limit > 0) {
                        duplicateSet.add(id);
                        yield row;
                        limit -= 1;
                        continue;
                    }
                    return;
                }
            }
        }
    };

export default iterateUnion;
