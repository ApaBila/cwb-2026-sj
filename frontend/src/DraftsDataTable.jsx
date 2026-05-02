/**
 * Sortable, column-filterable drafts grid.
 * Built with TanStack Table v8 — MIT
 * - Docs: https://tanstack.com/table/latest
 * - Source: https://github.com/TanStack/table
 */
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Checkbox } from 'flowbite-react';

function includesTextFilter(row, columnId, filterValue) {
  if (filterValue == null || filterValue === '') return true;
  const cell = row.getValue(columnId);
  return String(cell ?? '')
    .toLowerCase()
    .includes(String(filterValue).toLowerCase());
}

/** @param {Record<string, number>} order */
function sortByOrdinalMap(order, unknownRank = 999) {
  /** @type {import('@tanstack/react-table').SortingFn<any>} */
  return (rowA, rowB, columnId) => {
    const a = order[String(rowA.getValue(columnId))] ?? unknownRank;
    const b = order[String(rowB.getValue(columnId))] ?? unknownRank;
    return a - b;
  };
}

const ACTION_TYPE_SORT_ORDER = {
  new_task: 0,
  update: 1,
  conflict_needs_clarification: 2,
};

const PRIORITY_SORT_ORDER = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

const CONFIDENCE_SORT_ORDER = {
  Low: 0,
  Medium: 1,
  High: 2,
};

/** @param {'start' | 'due'} which */
function sortByDraftDate(which) {
  /** @type {import('@tanstack/react-table').SortingFn<any>} */
  return (rowA, rowB) => {
    const pick = (row) => {
      const r = row.original;
      const raw =
        which === 'start'
          ? r.planned_start || r.start_date_raw
          : r.planned_due || r.due_date_raw;
      if (raw == null || raw === '') return Number.POSITIVE_INFINITY;
      const t = Date.parse(String(raw));
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
    };
    return pick(rowA) - pick(rowB);
  };
}

const columns = [
  {
    id: 'project_id',
    accessorKey: 'project_id',
    header: 'Project',
    cell: (info) => info.getValue() || '—',
    filterFn: includesTextFilter,
    sortingFn: 'alphanumeric',
  },
  {
    id: 'task_title',
    accessorKey: 'task_title',
    header: 'Task',
    filterFn: includesTextFilter,
    sortingFn: 'alphanumeric',
  },
  {
    id: 'owner_name',
    accessorKey: 'owner_name',
    header: 'Owner',
    cell: (info) => info.getValue() || '—',
    filterFn: includesTextFilter,
    sortingFn: 'alphanumeric',
  },
  {
    id: 'start_display',
    accessorFn: (row) => String(row.planned_start || row.start_date_raw || ''),
    header: 'Start Date',
    cell: (info) => {
      const row = info.row.original;
      return row.planned_start || row.start_date_raw || '—';
    },
    filterFn: includesTextFilter,
    sortingFn: sortByDraftDate('start'),
  },
  {
    id: 'due_display',
    accessorFn: (row) => String(row.planned_due || row.due_date_raw || ''),
    header: 'Due Date',
    cell: (info) => {
      const row = info.row.original;
      return row.planned_due || row.due_date_raw || '—';
    },
    filterFn: includesTextFilter,
    sortingFn: sortByDraftDate('due'),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    filterFn: includesTextFilter,
    sortingFn: 'alphanumeric',
  },
  {
    id: 'dependency',
    accessorKey: 'dependency',
    header: 'Dependency',
    cell: (info) => info.getValue() || '—',
    filterFn: includesTextFilter,
    sortingFn: 'alphanumeric',
  },
  {
    id: 'percent_complete',
    accessorKey: 'percent_complete',
    header: '%',
    cell: (info) => {
      const v = info.getValue();
      return v != null ? `${v}%` : '—';
    },
    filterFn: includesTextFilter,
    sortingFn: 'basic',
  },
  {
    id: 'priority',
    accessorKey: 'priority',
    header: 'Priority',
    filterFn: includesTextFilter,
    sortingFn: sortByOrdinalMap(PRIORITY_SORT_ORDER),
  },
  {
    id: 'action_type',
    accessorKey: 'action_type',
    header: 'Action Type',
    cell: (info) => String(info.getValue() ?? '').replace(/_/g, ' ') || '—',
    filterFn: includesTextFilter,
    sortingFn: sortByOrdinalMap(ACTION_TYPE_SORT_ORDER),
  },
  {
    id: 'confidence',
    accessorKey: 'confidence',
    header: 'Confidence',
    cell: (info) => {
      const c = String(info.getValue() ?? '').toLowerCase();
      return (
        <span
          className={`confidence-badge confidence-${c} font-sans text-lg md:text-xl`}
        >
          {info.getValue()}
        </span>
      );
    },
    filterFn: includesTextFilter,
    sortingFn: sortByOrdinalMap(CONFIDENCE_SORT_ORDER),
  },
  {
    id: '_select',
    header: () => (
      <span className="flex w-full flex-col items-center justify-center font-sans text-lg font-semibold leading-tight text-black md:text-xl">
        Select All
      </span>
    ),
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row, table }) => {
      const meta = table.options.meta ?? {};
      const { selectedIds = new Set(), onToggle } = meta;
      const id = row.original.task_id;
      return (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={selectedIds.has(id)}
            onChange={() => onToggle?.(id)}
          />
        </div>
      );
    },
  },
];

/**
 * @param {{
 *   drafts: Record<string, unknown>[],
 *   selectedIds: Set<string>,
 *   onToggle: (taskId: string) => void,
 *   onToggleAllFiltered: (ids: string[]) => void,
 * }} props
 */
export default function DraftsDataTable({
  drafts,
  selectedIds,
  onToggle,
  onToggleAllFiltered,
}) {
  // TanStack Table returns unstable function refs; React Compiler skips memoization — safe here.
  // eslint-disable-next-line react-hooks/incompatible-library -- https://github.com/TanStack/table
  const table = useReactTable({
    data: drafts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      sorting: [{ id: 'due_display', desc: false }],
    },
    meta: {
      selectedIds,
      onToggle,
      onToggleAllFiltered,
    },
  });

  const clearFilters = () => {
    table.resetColumnFilters();
  };

  const hasFilters = table.getState().columnFilters.length > 0;

  const headerGroup = table.getHeaderGroups()[0];

  return (
    <div className="drafts-table-wrap flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-baseline gap-4">
        <p className="font-sans text-lg md:text-xl text-black">
          Showing{' '}
          <strong className="font-semibold text-black">
            {table.getFilteredRowModel().rows.length}
          </strong>
          {' / '}
          <span className="text-black">{drafts.length}</span> drafts
          {hasFilters ? (
            <span className="text-black/70"> (filtered)</span>
          ) : null}
        </p>
        {hasFilters && (
          <button
            type="button"
            className="font-sans text-lg md:text-xl font-semibold text-sjblue underline underline-offset-4 decoration-2 hover:text-sjred"
            onClick={clearFilters}
          >
            Clear column filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-black/10 rounded-lg bg-white">
        <table className="w-full text-left text-black">
          <thead className="bg-black/[0.04] text-black">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-3 py-3 font-sans text-lg md:text-xl font-semibold whitespace-nowrap border-b border-black/10 ${header.column.id === '_select' ? 'align-middle text-center' : 'align-bottom text-left'}`}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-2 font-sans text-lg md:text-xl font-semibold text-black hover:text-sjred text-left w-full"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                        <span className="shrink-0 text-black/60" aria-hidden>
                          {{
                            asc: '▲',
                            desc: '▼',
                          }[header.column.getIsSorted()] ?? '⇅'}
                        </span>
                      </button>
                    ) : (
                      <span
                        className={
                          header.column.id === '_select'
                            ? 'flex w-full items-center justify-center'
                            : 'inline-flex items-center gap-2'
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
            <tr>
              {headerGroup?.headers.map((header) => {
                const ctxTable = header.getContext().table;
                const meta = ctxTable.options.meta ?? {};
                const { selectedIds = new Set(), onToggleAllFiltered } = meta;
                const filtered = ctxTable.getFilteredRowModel().rows;
                const ids = filtered
                  .map((r) => r.original.task_id)
                  .filter(Boolean);
                const allSelected =
                  ids.length > 0 && ids.every((id) => selectedIds.has(id));

                return (
                  <th
                    key={`f-${header.id}`}
                    className={`px-3 pb-3 pt-1 border-b border-black/10 ${header.column.id === '_select' ? 'align-middle text-center' : 'align-top text-left'}`}
                  >
                    {header.column.id === '_select' ? (
                      <div className="flex items-center justify-center py-1">
                        <Checkbox
                          aria-label="Select all visible drafts"
                          checked={allSelected}
                          onChange={() => onToggleAllFiltered?.(ids)}
                        />
                      </div>
                    ) : header.column.getCanFilter() ? (
                      <input
                        type="search"
                        aria-label={`Filter ${header.column.id}`}
                        placeholder="Filter..."
                        value={header.column.getFilterValue() ?? ''}
                        onChange={(e) =>
                          header.column.setFilterValue(
                            e.target.value || undefined,
                          )
                        }
                        className="w-full min-w-[10rem] max-w-[18rem] box-border rounded border-2 border-black/20 bg-white px-2 py-1 font-sans text-lg md:text-xl font-semibold text-black placeholder:text-black/35 placeholder:font-normal focus:border-sjblue focus:outline-none"
                      />
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="font-sans text-lg md:text-xl text-black">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-black/70"
                >
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-black/5 hover:bg-black/[0.02]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-3 py-3 align-middle whitespace-nowrap ${cell.column.id === '_select' ? 'text-center' : ''}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
