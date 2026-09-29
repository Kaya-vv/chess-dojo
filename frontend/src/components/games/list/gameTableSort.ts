import { GridComparatorFn, GridSortDirection } from '@mui/x-data-grid-pro';

/**
 * Returns the local storage key of the sort model of the GameTable with the given namespace.
 * @param namespace The namespace of the GameTable.
 */
export function getGameTableSortModelKey(namespace: string): string {
    return `/GameTable/${namespace}/sortModel`;
}

/**
 * Returns the comparator of the GameTable Played column. PGN dates are compared by code
 * units, the order DynamoDB uses for game ids, so partial dates such as `2024.05.??` sort as
 * later than the known days of their period (after them ascending, before them descending).
 * Undated games (missing date, or a date starting with `?` or any later character, such as
 * `????.??.??`) come last in both directions.
 *
 * The masters games list pages games in exactly this order (see listGames.ts in the backend
 * pgnService), so rows loaded from later pages are appended below the existing rows.
 * @param sortDirection The direction of the sort.
 */
export function getPlayedDateSortComparator(
    sortDirection: GridSortDirection,
): GridComparatorFn<string | undefined> {
    const sign = sortDirection === 'desc' ? -1 : 1;
    return (a = '', b = '') => {
        const aUndated = !a || a >= '?';
        const bUndated = !b || b >= '?';
        if (aUndated || bUndated) {
            return Number(aUndated) - Number(bUndated);
        }
        if (a === b) {
            return 0;
        }
        return a < b ? -sign : sign;
    };
}
