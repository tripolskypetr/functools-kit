import IRowData, { RowId } from "../model/IRowData";

export const iterateUnion = <Data = IRowData>(iterators: AsyncGenerator<Data | Data[], void, unknown>[], getId = (data: Data) => data["id"]) =>
    async function* (limit: number, offset: number) {
        const duplicateSet = new Set<RowId>();
        try {
            for (const iterator of iterators) {
                for await (const chunk of iterator) {
                    const rows = [chunk].flatMap(v => v);
                    for (const row of rows) {
                        const id = getId(row);
                        if (duplicateSet.has(id)) {
                            continue;
                        }
                        if (offset > 0) {
                            duplicateSet.add(id);
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
        } finally {
            // close every source iterator on limit exhaustion, early consumer
            // exit, or an error in one source — otherwise the remaining
            // sources (cursors/connections) leak
            for (const iterator of iterators) {
                try {
                    await iterator.return?.();
                } catch {
                    /* ignore cleanup errors */
                }
            }
        }
    };

export default iterateUnion;
