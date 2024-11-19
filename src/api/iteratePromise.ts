import IRowData from "../model/IRowData";

export async function* iteratePromise<Data = IRowData>(fn: () => Promise<Data[]>) {
    for (const row of await fn()) {
        yield row;
    }
};

export default iteratePromise;
