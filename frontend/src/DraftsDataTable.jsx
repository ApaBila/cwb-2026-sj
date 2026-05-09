/**
 * Sortable, column-filterable drafts grid.
 * Built with TanStack Table v8 — MIT
 * - Docs: https://tanstack.com/table/latest
 * - Source: https://github.com/TanStack/table
 */
import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Checkbox } from 'flowbite-react';
import { ownerInitials } from './utils/initials';

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

/** Shared checkbox column for drafts and unscheduled grids (TanStack Table meta). */
const SELECT_COLUMN = {
  id: '_select',
  header: () => (
    <span className="flex w-full flex-col items-center justify-center font-sans text-sj-body font-semibold leading-tight text-black">
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
};

/** Subset aligned with Gantt frozen columns (Project / Task / Owner). */
const UNSCHEDULED_COLUMNS = [
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
    accessorFn: (row) =>
      [row.owner_name, row.owner_id].filter(Boolean).join(' ') || '',
    header: 'Owner',
    cell: (info) => {
      const r = info.row.original;
      return ownerInitials(r.owner_name, r.owner_id);
    },
    filterFn: includesTextFilter,
    sortingFn: 'alphanumeric',
  },
  SELECT_COLUMN,
];

const FULL_COLUMNS = [
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
        <span className={`confidence-badge confidence-${c}`}>
          {info.getValue()}
        </span>
      );
    },
    filterFn: includesTextFilter,
    sortingFn: sortByOrdinalMap(CONFIDENCE_SORT_ORDER),
  },
  SELECT_COLUMN,
];

/**
 * Fixed layout width (px) so headers/filters never collapse when the viewport
 * narrows — the outer wrapper scrolls horizontally instead. Sum of col widths.
 */
const DRAFTS_TABLE_MIN_WIDTH_PX = 1180;
const UNSCHEDULED_TABLE_MIN_WIDTH_PX = 592;

/** `table-layout: fixed` column widths (px). Order matches `columns`. */
const DRAFTS_COLGROUP = (
  <colgroup>
    <col style={{ width: 88 }} />
    <col style={{ width: 160 }} />
    <col style={{ width: 84 }} />
    <col style={{ width: 96 }} />
    <col style={{ width: 96 }} />
    <col style={{ width: 88 }} />
    <col style={{ width: 104 }} />
    <col style={{ width: 52 }} />
    <col style={{ width: 84 }} />
    <col style={{ width: 136 }} />
    <col style={{ width: 120 }} />
    <col style={{ width: 72 }} />
  </colgroup>
);

const UNSCHEDULED_COLGROUP = (
  <colgroup>
    <col style={{ width: 120 }} />
    <col style={{ width: 280 }} />
    <col style={{ width: 120 }} />
    <col style={{ width: 72 }} />
  </colgroup>
);

/**
 * @param {{
 *   drafts: Record<string, unknown>[],
 *   selectedIds?: Set<string>,
 *   onToggle?: (taskId: string) => void,
 *   onToggleAllFiltered?: (ids: string[]) => void,
 *   variant?: 'drafts' | 'unscheduled',
 *   layout?: 'default' | 'embedded',
 *   embeddedFillViewport?: boolean,
 * }} props
 */
export default function DraftsDataTable({
  drafts,
  selectedIds = new Set(),
  onToggle = () => {},
  onToggleAllFiltered = () => {},
  variant = 'drafts',
  layout = 'default',
  embeddedFillViewport = false,
}) {
  const activeColumns = useMemo(
    () => (variant === 'unscheduled' ? UNSCHEDULED_COLUMNS : FULL_COLUMNS),
    [variant],
  );

  // TanStack Table returns unstable function refs; React Compiler skips memoization — safe here.
  // eslint-disable-next-line react-hooks/incompatible-library -- https://github.com/TanStack/table
  const table = useReactTable({
    data: drafts,
    columns: activeColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      sorting: [
        variant === 'unscheduled'
          ? { id: 'task_title', desc: false }
          : { id: 'due_display', desc: false },
      ],
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
  const minWidth =
    variant === 'unscheduled' ? UNSCHEDULED_TABLE_MIN_WIDTH_PX : DRAFTS_TABLE_MIN_WIDTH_PX;
  const colgroup = variant === 'unscheduled' ? UNSCHEDULED_COLGROUP : DRAFTS_COLGROUP;
  const rowLabel = variant === 'unscheduled' ? 'unscheduled tasks' : 'drafts';
  const embedFill =
    layout === 'embedded' && embeddedFillViewport;
  const wrapClass = embedFill
    ? 'drafts-table-wrap flex min-h-0 min-w-0 flex-1 flex-col gap-2'
    : layout === 'embedded'
      ? 'drafts-table-wrap flex min-w-0 flex-col gap-2'
      : 'drafts-table-wrap flex min-h-0 min-w-0 flex-1 flex-col gap-2';

  return (
    <div className={wrapClass}>
      <div className="flex shrink-0 flex-wrap items-baseline gap-3">
        <p className="sj-text-h2 text-black">
          Showing{' '}
          <strong className="font-semibold text-black">
            {table.getFilteredRowModel().rows.length}
          </strong>
          {' / '}
          <span className="text-black">{drafts.length}</span> {rowLabel}
          {hasFilters ? (
            <span className="text-black/70"> (filtered)</span>
          ) : null}
        </p>
        {hasFilters && (
          <button
            type="button"
            className="font-sans font-semibold text-sj-control leading-tight text-sjblue underline decoration-2 underline-offset-4 hover:text-sjred"
            onClick={clearFilters}
          >
            Clear column filters
          </button>
        )}
      </div>

      <div
        className={
          embedFill
            ? 'min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain border border-black/10 bg-white'
            : layout === 'embedded'
              ? 'overflow-x-auto overflow-y-auto overscroll-x-contain border border-black/10 bg-white'
              : 'min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain border border-black/10 bg-white'
        }
      >
        <table
          className="table-fixed w-full text-left text-black"
          style={{ minWidth: minWidth }}
        >
          {colgroup}
          <thead className="bg-black/10 text-black">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-2 py-2 font-sans text-sj-body font-semibold whitespace-nowrap border-b border-black/10 ${header.column.id === '_select' ? 'align-middle text-center' : 'align-bottom text-left overflow-hidden'}`}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex w-full min-w-0 items-center gap-2 overflow-hidden text-left font-sans text-sj-body font-semibold text-black hover:text-sjred"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="min-w-0 truncate">
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
                    className={`px-2 pb-2 pt-1 border-b border-black/10 ${header.column.id === '_select' ? 'align-middle text-center' : 'align-top text-left'}`}
                  >
                    {header.column.id === '_select' ? (
                      <div className="flex items-center justify-center py-0.5">
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
                        className="box-border w-full min-w-[5.5rem] max-w-full border-2 border-black/20 bg-white px-1.5 py-0.5 font-sans text-sj-body font-semibold text-black placeholder:text-black/35 placeholder:font-normal focus:border-sjblue focus:outline-none"
                      />
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="font-sans text-sj-body text-black">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length}
                  className="px-3 py-6 text-center font-sans text-sj-body text-black/70"
                >
                  {hasFilters
                    ? 'No rows match the current filters.'
                    : variant === 'unscheduled'
                      ? 'No unscheduled tasks.'
                      : 'No rows match the current filters.'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-black/5 hover:bg-black/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={
                        cell.column.id === '_select'
                          ? 'px-2 py-2 text-center align-middle whitespace-nowrap'
                          : cell.column.id === 'confidence'
                            ? 'px-2 py-2 align-middle whitespace-nowrap'
                            : 'max-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2 align-middle'
                      }
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
