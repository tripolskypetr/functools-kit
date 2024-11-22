import IRowData from "./IRowData";

/**
 * Represents a type for offset pagination.
 * @typeparam FilterData - The type of filter data.
 * @typeparam RowData - The type of row data.
 * @typeparam Payload - The type of payload.
 *
 * @param filterData - The filter data to be applied to the dataset.
 * @param limit - The maximum number of records to be returned.
 * @param offset - The offset from which to start retrieving records.
 * @param payload - The payload containing additional parameters for filtering.
 *
 * @returns - A promise resolving to an array of filtered row data or an array of filtered row data.
 */
export interface TOffsetPaginator<
    FilterData extends {} = any,
    RowData extends IRowData = any,
    Payload = any
> {
    (filterData: FilterData, limit: number, offset: number, payload: Payload): Promise<RowData[]> | RowData[];
} 

export default TOffsetPaginator;
