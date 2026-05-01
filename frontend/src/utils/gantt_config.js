export const DEFAULT_VIEW_MODES = [
  { name: 'Day', step: '1d', column_width: 48, date_format: 'YYYY-MM-DD' },
  { name: 'Week', step: '7d', column_width: 80, date_format: 'YYYY-MM-DD' },
  { name: 'Month', step: '30d', column_width: 120, date_format: 'YYYY-MM-DD' },
];

export const DEFAULT_OPTIONS = {
  view_mode: 'Day',
  column_width: null,
  bar_height: 18,
  padding: 8,
  lower_header_height: 22,
  upper_header_height: 28,
  container_height: 'auto',
};
