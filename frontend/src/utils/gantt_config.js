export const DEFAULT_VIEW_MODES = [
  { name: 'Day', step: '1d', column_width: 34, date_format: 'YYYY-MM-DD' },
  { name: 'Week', step: '7d', column_width: 54, date_format: 'YYYY-MM-DD' },
  { name: 'Month', step: '30d', column_width: 84, date_format: 'YYYY-MM-DD' },
];

/**
 * Frozen + timeline chart header height (px). Must match the two thead rows in
 * Gantt.jsx (DraftsDataTable-style label row + filter row).
 */
export const GANTT_HEADER_ROW1_PX = 40;
export const GANTT_HEADER_ROW2_PX = 36;
export const GANTT_CHART_HEADER_PX = GANTT_HEADER_ROW1_PX + GANTT_HEADER_ROW2_PX;

/** Extra space below last bar in the body SVG (px). */
export const GANTT_CHART_BODY_BOTTOM_PAD = 40;

export const DEFAULT_OPTIONS = {
  view_mode: 'Day',
  column_width: null,
  /** Bar thickness inside each row stripe (row = bar_height + padding). */
  bar_height: 22,
  /** Vertical gap between bar rows; matches frozen tbody row height (py-2 + text-sj-body). */
  padding: 14,
  lower_header_height: 22,
  /** First bar row starts after chart header (see GANTT_CHART_HEADER_PX). */
  upper_header_height: GANTT_CHART_HEADER_PX,
  container_height: 'auto',
};
