import IRowData from "./IRowData";

/**
 * Represents an item used for sorting in a list.
 * @template RowData - The type of the row data in the list.
 */
export interface IListSortItem<RowData extends IRowData = any> {
  field: keyof RowData;
  sort: 'asc' | 'desc';
}

/**
 * Represents a pagination handler for a list.
 *
 * @typedef ListHandlerPagination
 * @property  limit - The number of items to retrieve per page.
 * @property  offset - The starting index of the items to retrieve.
 */
export type ListHandlerPagination = {
  limit: number;
  offset: number;
};

/**
 * Represents a list handler for chips.
 * @template RowData - The type of row data.
 */
export type ListHandlerChips<RowData extends IRowData = any> = Partial<Record<keyof RowData, boolean>>;

/**
 * Represents a sorting model for a list handler.
 *
 * @template RowData - The type of data in list rows.
 */
export type ListHandlerSortModel<RowData extends IRowData = any> = IListSortItem<RowData>[];


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
export type TPaginator<
  FilterData extends {} = any,
  RowData extends IRowData = any,
  Payload = any
> = (
  data: FilterData,
  pagination: ListHandlerPagination,
  sort: ListHandlerSortModel<RowData>,
  chips: ListHandlerChips<RowData>,
  search: string,
  payload: Payload
) => Promise<
  | {
      rows: RowData[];
      total: number | null;
    }
  | RowData[]
>;

export default TPaginator;
