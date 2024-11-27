import IRowData from "./IRowData";
import { ListHandlerPagination } from "./TPaginator";

/**
 * Type definition for TPaginator.
 *
 * @template FilterData - The type of data used for filtering.
 * @template RowData - The type of data representing a row.
 * @template Payload - The type of additional payload data.
 *
 * @param data - The filter data.
 * @param pagination - The pagination settings.
 * @param sort - The sorting settings.
 * @param chips - The chip filters.
 * @param search - The search string.
 * @param payload - The additional payload data.
 *
 * @returns A promise that resolves to either an array of row data or an object containing rows and total count.
 */
export type TBasePaginator<
  FilterData extends {} = any,
  RowData extends IRowData = any
> = (
  data: FilterData,
  pagination: ListHandlerPagination,
) => Promise<{
  rows: RowData[];
  total: number;
}>;

export default TBasePaginator;
