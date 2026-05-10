import date_utils from './date_utils';
import { sortTasksForGanttLayout } from './gantt_task_order';

export const DEFAULT_VIEW_MODES = [
  { name: 'Day', step: '1d', column_width: 52, date_format: 'YYYY-MM-DD' },
  { name: 'Week', step: '7d', column_width: 54, date_format: 'YYYY-MM-DD' },
  { name: 'Month', step: '30d', column_width: 84, date_format: 'YYYY-MM-DD' },
];

/**
 * Frozen + timeline chart header height (px). Must match the two thead rows in
 * Gantt.jsx (DraftsDataTable-style label row + filter row).
 */
export const GANTT_HEADER_ROW1_PX = 44;
export const GANTT_HEADER_ROW2_PX = 38;
export const GANTT_CHART_HEADER_PX = GANTT_HEADER_ROW1_PX + GANTT_HEADER_ROW2_PX;

/** SVG <text> baselines (timeline header matches frozen thead total height). */
export const GANTT_HEADER_LINE1_Y = 26;
/** Week / Month second line (single label row under DOW/year). */
export const GANTT_HEADER_LINE2_Y = 56;
/** Day view: month abbreviation, top half of row 2 (sits cleanly below DOW row 1). */
export const GANTT_HEADER_LINE2_DAY_MONTH_Y = 60;
/** Day view: day-of-month digits, bottom half of row 2 (directly under month). */
export const GANTT_HEADER_LINE3_DAY_DAY_Y = 76;

/** Extra space below last bar in the body SVG (px). */
export const GANTT_CHART_BODY_BOTTOM_PAD = 40;

export const DEFAULT_OPTIONS = {
  view_mode: 'Day',
  column_width: null,
  /** Bar thickness inside each row stripe (row = bar_height + padding). */
  bar_height: 24,
  /** Vertical gap between bar rows; matches frozen tbody row height (py-2 + text-sj-body). */
  padding: 16,
  lower_header_height: 22,
  /** First bar row starts after chart header (see GANTT_CHART_HEADER_PX). */
  upper_header_height: GANTT_CHART_HEADER_PX,
  container_height: 'auto',
};

/** Layout-only keys stripped */
const EDIT_PREFILL_LAYOUT_KEYS = new Set(['x', 'y', 'w', 'index']);

/** Stable column order for human-readable prefilled edit blocks. */
const EDIT_PREFILL_FIELD_ORDER = [
  'task_id',
  'task_title',
  'source_date_iso',
  'project_id',
  'owner_id',
  'owner_name',
  'start_date_raw',
  'planned_start',
  'due_date_raw',
  'planned_due',
  'status',
  'dependency',
  'percent_complete',
  'priority',
  'source',
  'confidence',
  'action_type',
  'is_approved',
  'dependencies',
];

function formatEditPrefillValue(value) {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '—' : date_utils.format(value, 'YYYY-MM-DD');
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '—';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** Same rule as Gantt.jsx: scheduled means both planned start and due are present and valid. */
function hasValidSchedule(t) {
  const ps = t.planned_start ?? t.start_date_raw;
  const pd = t.planned_due ?? t.due_date_raw;
  if (ps == null || ps === '' || pd == null || pd === '') return false;
  const a = ps instanceof Date ? ps : new Date(String(ps));
  const b = pd instanceof Date ? pd : new Date(String(pd));
  return !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime());
}

/** Coerce to Date for `sortTasksForGanttLayout` (Gantt rows use Date; drafts may be ISO strings). */
function taskRowForGanttSort(t) {
  const ps = t.planned_start ?? t.start_date_raw;
  const pd = t.planned_due ?? t.due_date_raw;
  const planned_start = ps instanceof Date ? ps : new Date(String(ps));
  const planned_due = pd instanceof Date ? pd : new Date(String(pd));
  return { ...t, planned_start, planned_due };
}

/**
 * Hand-written-form blob for the Get In textarea (same format as Stay In → Edit on Gantt / unscheduled).
 * Order matches the Gantt page: **unscheduled first** (same relative order as the passed-in list / table),
 * then **scheduled** rows sorted by `sortTasksForGanttLayout` (project → start → due → task_id).
 *
 * @param {Record<string, unknown>[]} tasks
 */
export function formatTasksAsEditPrefill(tasks) {
  const unscheduled = [];
  const scheduled = [];
  for (const t of tasks) {
    if (hasValidSchedule(t)) scheduled.push(t);
    else unscheduled.push(t);
  }
  const sortedScheduled = sortTasksForGanttLayout(scheduled.map(taskRowForGanttSort));
  const ordered = [...unscheduled, ...sortedScheduled];
  const blocks = [];
  for (const raw of ordered) {
    const row = { ...raw };
    EDIT_PREFILL_LAYOUT_KEYS.forEach((k) => {
      delete row[k];
    });
    const lines = [`--- Task ${row.task_id ?? '—'} ---`];
    for (const key of EDIT_PREFILL_FIELD_ORDER) {
      if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
      lines.push(`${key}: ${formatEditPrefillValue(row[key])}`);
    }
    for (const key of Object.keys(row).sort()) {
      if (EDIT_PREFILL_FIELD_ORDER.includes(key)) continue;
      lines.push(`${key}: ${formatEditPrefillValue(row[key])}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}
