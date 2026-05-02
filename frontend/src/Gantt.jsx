import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Button, Card, Dropdown, DropdownItem, Spinner, Progress } from 'flowbite-react';
import date_utils from './utils/date_utils';
import {
  DEFAULT_VIEW_MODES,
  DEFAULT_OPTIONS,
  GANTT_CHART_HEADER_PX,
  GANTT_HEADER_ROW1_PX,
  GANTT_HEADER_ROW2_PX,
  GANTT_CHART_BODY_BOTTOM_PAD,
} from './utils/gantt_config';
import { ownerInitials } from './utils/initials';

/** Width of sticky identifier column (px). */
const FROZEN_PANEL_WIDTH = 252;

/** Same filter semantics as DraftsDataTable (includesTextFilter). */
function cellIncludesFilter(value, filterRaw) {
  if (filterRaw == null || filterRaw === '') return true;
  return String(value ?? '')
    .toLowerCase()
    .includes(String(filterRaw).toLowerCase());
}

const FROZEN_COLGROUP = (
  <colgroup>
    <col style={{ width: '26%' }} />
    <col style={{ width: '48%' }} />
    <col style={{ width: '26%' }} />
  </colgroup>
);

/** DraftsDataTable thead label cell classes (no sort); uses text-sj-body from index.css. */
const thLabelClass =
  'px-2 py-2 font-sans text-sj-body font-semibold whitespace-nowrap border-b border-black/10 align-bottom text-left';
/** DraftsDataTable thead filter row cell classes. */
const thFilterClass =
  'px-2 pb-2 pt-1 border-b border-black/10 align-top text-left';
/** DraftsDataTable filter input classes. */
const filterInputClass =
  'w-full min-w-0 max-w-[18rem] box-border border-2 border-black/20 bg-white px-2 py-0.5 font-sans text-sj-body font-semibold text-black placeholder:text-black/35 placeholder:font-normal focus:border-sjblue focus:outline-none';

/** Keeps day-scale date labels inside each column (avoids overlap when columnWidth is small). */
function ganttDateLabelMetrics(columnWidth) {
  const textLength = Math.max(10, columnWidth - 8);
  const fontSize = Math.min(9, Math.max(6, Math.floor(columnWidth * 0.2)));
  return { textLength, fontSize };
}

function Gantt() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(DEFAULT_VIEW_MODES[0].name);
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [columnFilters, setColumnFilters] = useState({
    project_id: '',
    task_title: '',
    owner_name: '',
  });
  const containerRef = useRef();
  const tooltipWidth = 320;

  const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/tasks`);
      const data = await res.json();
      const normalized = data
        .map((t) => ({
          ...t,
          planned_start: t.planned_start ? date_utils.parse(t.planned_start) : null,
          planned_due: t.planned_due ? date_utils.parse(t.planned_due) : null,
        }))
        .filter((t) => t.planned_start && t.planned_due);
      setTasks(normalized);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchTasks();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!cellIncludesFilter(t.project_id, columnFilters.project_id)) return false;
      if (!cellIncludesFilter(t.task_title, columnFilters.task_title)) return false;
      const ownerLabel = t.owner_name ?? t.owner_id ?? '';
      if (!cellIncludesFilter(ownerLabel, columnFilters.owner_name)) return false;
      return true;
    });
  }, [tasks, columnFilters]);

  const hasFilters = Object.values(columnFilters).some((v) => v && String(v).trim() !== '');

  const clearFilters = () => {
    setColumnFilters({ project_id: '', task_title: '', owner_name: '' });
  };

  function showHoveredTask(task) {
    const container = containerRef.current;
    if (!container) {
      setHovered(task);
      setTooltipPos({ left: task.x + 8, top: task.y - 48 });
      return;
    }

    const padding = 12;
    const visibleLeft = container.scrollLeft;
    const visibleTop = container.scrollTop;
    const visibleRight = visibleLeft + container.clientWidth;
    const visibleBottom = visibleTop + container.clientHeight;

    let left = task.x + task.w + padding;
    if (left + tooltipWidth > visibleRight) {
      left = Math.max(visibleLeft + padding, task.x - tooltipWidth - padding);
    }

    let top = task.y - 24;
    if (top < visibleTop + padding) {
      top = task.y + DEFAULT_OPTIONS.bar_height + padding;
    }
    if (top + 140 > visibleBottom) {
      top = Math.max(visibleTop + padding, visibleBottom - 140 - padding);
    }

    setHovered(task);
    setTooltipPos({ left, top });
  }

  const layout = useMemo(() => {
    if (!filteredTasks.length) return null;

    const starts = filteredTasks.map((t) => t.planned_start);
    const ends = filteredTasks.map((t) => t.planned_due);
    let gantt_start = new Date(Math.min.apply(null, starts));
    let gantt_end = new Date(Math.max.apply(null, ends));

    gantt_start = date_utils.start_of(gantt_start, 'day');
    gantt_end = date_utils.add(gantt_end, 1, 'day');

    const vm = DEFAULT_VIEW_MODES.find((v) => v.name === viewMode) || DEFAULT_VIEW_MODES[0];
    const columnWidth = vm.column_width || DEFAULT_OPTIONS.column_width || 48;
    let stepDays = 1;
    if (vm.step && typeof vm.step === 'string' && vm.step.endsWith('d')) {
      stepDays = parseInt(vm.step.replace('d', ''), 10) || 1;
    }

    const days = [];
    for (let d = new Date(gantt_start); d <= gantt_end; d = date_utils.add(d, stepDays, 'day')) {
      days.push(new Date(d));
    }

    const rowHeight = DEFAULT_OPTIONS.bar_height + DEFAULT_OPTIONS.padding;
    const bars = filteredTasks.map((t, i) => {
      const daysFromStart = date_utils.diff(t.planned_start, gantt_start, 'day');
      const durationDays = date_utils.diff(t.planned_due, t.planned_start, 'day') + 1;
      const x = (daysFromStart / stepDays) * columnWidth;
      const w = Math.max(2, (durationDays / stepDays) * columnWidth);
      const y = i * rowHeight;
      return { ...t, x, y, w, index: i };
    });

    return {
      gantt_start,
      gantt_end,
      columnWidth,
      days,
      bars,
      width: days.length * columnWidth,
      rowHeight,
    };
  }, [filteredTasks, viewMode]);

  if (loading) {
    return (
      <main className="gantt-page flex min-h-0 min-w-0 flex-1 items-center justify-center bg-white p-4">
        <Spinner className="h-10 w-10 md:h-12 md:w-12" />
      </main>
    );
  }

  const bodySvgHeight =
    layout != null
      ? layout.bars.length * layout.rowHeight + GANTT_CHART_BODY_BOTTOM_PAD
      : 0;

  const dateLabelY = Math.round(GANTT_HEADER_ROW1_PX * 0.55);

  return (
    <main className="gantt-page flex min-h-0 min-w-0 flex-1 flex-col bg-white">
    <Card className="gantt-card flex w-full min-h-0 min-w-0 flex-1 flex-col rounded-none border-0 bg-white p-4 shadow-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-baseline justify-between gap-3">
        <div className="relative z-50 flex flex-wrap items-center gap-2">
          <Dropdown
            label={<span className="sj-text-h2 text-black">View: {viewMode}</span>}
            inline={true}
          >
            {DEFAULT_VIEW_MODES.map((m) => (
              <DropdownItem
                key={m.name}
                className="font-sans text-sj-body"
                onClick={() => setViewMode(m.name)}
              >
                {m.name}
              </DropdownItem>
            ))}
          </Dropdown>
          <Button pill size="xl" onClick={() => fetchTasks()}>Refresh</Button>
          <Button pill size="xl" outline onClick={() => containerRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}>Beginning</Button>
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
        <div className="flex flex-wrap items-baseline gap-3">
          {layout ? (
            <p className="sj-text-h2 m-0 text-black">
              Showing{' '}
              <strong className="font-semibold text-black">{layout.bars.length}</strong>
              {' / '}
              <span className="text-black">{tasks.length}</span> tasks
              {hasFilters ? <span className="text-black/70"> (filtered)</span> : null}
            </p>
          ) : tasks.length > 0 ? (
            <p className="sj-text-h2 m-0 text-black/70">No rows match the current filters.</p>
          ) : (
            <p className="sj-text-h2 m-0 text-black">
              <strong className="font-semibold text-black">{tasks.length}</strong> tasks
            </p>
          )}
        </div>
      </div>

      <div
        className="gantt-container relative z-0 min-h-0 flex-1 overflow-auto overflow-x-auto border border-black/10 bg-white"
        ref={containerRef}
      >
        {layout ? (
          <div className="flex min-w-min flex-col">
            {/* Chart header: frozen thead + timeline strip (same height as DraftsDataTable two-row thead). */}
            <div className="sticky top-0 z-30 flex min-w-min items-stretch bg-white">
              <div
                className="sticky left-0 z-40 shrink-0 border-r border-black/10 bg-white"
                style={{ width: FROZEN_PANEL_WIDTH }}
                aria-label="Task identifiers"
              >
                <table className="w-full table-fixed text-left text-black">
                  {FROZEN_COLGROUP}
                  <thead className="bg-black/10 text-black">
                    <tr>
                      <th
                        className={`${thLabelClass} box-border`}
                        style={{ height: GANTT_HEADER_ROW1_PX, boxSizing: 'border-box' }}
                      >
                        <span className="inline-flex items-center gap-2">Project</span>
                      </th>
                      <th
                        className={`${thLabelClass} box-border`}
                        style={{ height: GANTT_HEADER_ROW1_PX, boxSizing: 'border-box' }}
                      >
                        <span className="inline-flex items-center gap-2">Task</span>
                      </th>
                      <th
                        className={`${thLabelClass} box-border`}
                        style={{ height: GANTT_HEADER_ROW1_PX, boxSizing: 'border-box' }}
                      >
                        <span className="inline-flex items-center gap-2">Owner</span>
                      </th>
                    </tr>
                    <tr>
                      <th
                        className={`${thFilterClass} box-border`}
                        style={{ height: GANTT_HEADER_ROW2_PX, boxSizing: 'border-box' }}
                      >
                        <input
                          type="search"
                          aria-label="Filter project_id"
                          placeholder="Filter..."
                          value={columnFilters.project_id}
                          onChange={(e) =>
                            setColumnFilters((f) => ({ ...f, project_id: e.target.value }))
                          }
                          className={filterInputClass}
                        />
                      </th>
                      <th
                        className={`${thFilterClass} box-border`}
                        style={{ height: GANTT_HEADER_ROW2_PX, boxSizing: 'border-box' }}
                      >
                        <input
                          type="search"
                          aria-label="Filter task_title"
                          placeholder="Filter..."
                          value={columnFilters.task_title}
                          onChange={(e) =>
                            setColumnFilters((f) => ({ ...f, task_title: e.target.value }))
                          }
                          className={filterInputClass}
                        />
                      </th>
                      <th
                        className={`${thFilterClass} box-border`}
                        style={{ height: GANTT_HEADER_ROW2_PX, boxSizing: 'border-box' }}
                      >
                        <input
                          type="search"
                          aria-label="Filter owner_name"
                          placeholder="Filter..."
                          value={columnFilters.owner_name}
                          onChange={(e) =>
                            setColumnFilters((f) => ({ ...f, owner_name: e.target.value }))
                          }
                          className={filterInputClass}
                        />
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div
                className="relative shrink-0 border-b border-black/10 bg-white"
                style={{ minWidth: layout.width, width: layout.width, height: GANTT_CHART_HEADER_PX }}
              >
                <svg
                  className="gantt-svg-header block"
                  width={layout.width}
                  height={GANTT_CHART_HEADER_PX}
                  aria-hidden
                >
                  <rect className="fill-white" x={0} y={0} width={layout.width} height={GANTT_CHART_HEADER_PX} />
                  {layout.days.map((d, i) => {
                    let formatStr = 'MM/DD';
                    if (viewMode === 'Month') formatStr = 'YY/MM';
                    else if (viewMode === 'Week') formatStr = 'MMM DD';
                    const label = date_utils.format(d, formatStr);
                    const { textLength, fontSize } = ganttDateLabelMetrics(layout.columnWidth);
                    return (
                      <text
                        key={i}
                        x={i * layout.columnWidth + 4}
                        y={dateLabelY}
                        fontSize={fontSize}
                        textLength={textLength}
                        lengthAdjust="spacingAndGlyphs"
                        className="grid-header fill-black font-sans font-semibold"
                      >
                        {label}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Body: frozen rows + bars (row height matches DraftsDataTable tbody). */}
            <div className="flex min-w-min items-stretch">
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-black/10 bg-white"
                style={{ width: FROZEN_PANEL_WIDTH }}
              >
                <table className="w-full table-fixed text-left text-black">
                  {FROZEN_COLGROUP}
                  <tbody className="font-sans text-sj-body text-black">
                    {layout.bars.map((b) => (
                      <tr
                        key={`frozen-${b.task_id}`}
                        className="border-b border-black/5 hover:bg-black/5"
                        style={{ height: layout.rowHeight }}
                        title={`${b.task_title}\n${date_utils.format(b.planned_start)} → ${date_utils.format(b.planned_due)}`}
                      >
                        <td className="px-2 py-2 align-middle whitespace-nowrap">
                          {b.project_id || '—'}
                        </td>
                        <td className="max-w-0 min-w-0 px-2 py-2 align-middle">
                          <span className="block truncate">{b.task_title}</span>
                        </td>
                        <td className="px-2 py-2 align-middle text-center whitespace-nowrap font-semibold tabular-nums">
                          {ownerInitials(b.owner_name, b.owner_id)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="relative shrink-0" style={{ minWidth: layout.width }}>
                <svg className="gantt-svg block" width={layout.width} height={bodySvgHeight}>
                  <rect
                    className="grid-background fill-white"
                    x={0}
                    y={0}
                    width={layout.width}
                    height={bodySvgHeight}
                  />
                  {layout.bars.map((b) => (
                    <g key={b.task_id}>
                      <foreignObject
                        x={b.x}
                        y={b.y}
                        width={b.w}
                        height={DEFAULT_OPTIONS.bar_height}
                      >
                        <div className="flex h-full w-full flex-col justify-center px-0.5">
                          <Progress
                            progress={b.percent_complete || 0}
                            size="lg"
                            color="black"
                            className={
                              b.priority === 'High'
                                ? 'bg-sjred'
                                : b.priority === 'Medium'
                                  ? 'bg-sjblue'
                                  : 'bg-black/50'
                            }
                          />
                        </div>
                      </foreignObject>
                    </g>
                  ))}
                  {layout.bars.map((b) =>
                    (b.dependencies || []).map((predId) => {
                      const pred = layout.bars.find((bb) => bb.task_id === predId);
                      if (!pred) return null;
                      const x1 = pred.x + pred.w;
                      const y1 = pred.y + DEFAULT_OPTIONS.bar_height / 2;
                      const x2 = b.x;
                      const y2 = b.y + DEFAULT_OPTIONS.bar_height / 2;
                      return (
                        <line
                          key={`${predId}-${b.task_id}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          className="line stroke-black stroke-2"
                        />
                      );
                    }),
                  )}
                </svg>

                {layout.bars.map((b) => (
                  <div
                    key={b.task_id}
                    className="bar-hover-overlay absolute cursor-pointer"
                    style={{ left: b.x, top: b.y, width: b.w, height: DEFAULT_OPTIONS.bar_height }}
                    onMouseEnter={() => showHoveredTask(b)}
                    onMouseLeave={() => {
                      setHovered(null);
                      setTooltipPos(null);
                    }}
                  />
                ))}

                {hovered && tooltipPos && (
                  <div
                    style={{ position: 'absolute', left: tooltipPos.left, top: tooltipPos.top, width: tooltipWidth }}
                    className="gantt-tooltip-card pointer-events-none"
                  >
                    <Card className="w-full rounded-none border border-black/10 bg-white p-3 shadow-none">
                      <div className="font-sans text-sj-body font-semibold text-black/70">Schedule detail</div>
                      <div className="font-sans text-sj-body font-semibold">{hovered.task_title}</div>
                      <div className="font-sans text-sj-body">{hovered.owner_name || '—'}</div>
                      <div className="font-sans text-sj-body">
                        {date_utils.format(hovered.planned_start)} → {date_utils.format(hovered.planned_due)}
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-4 text-center font-sans text-sj-body text-black/70">No tasks to display</div>
        ) : (
          <div className="px-3 py-6 text-center font-sans text-sj-body text-black/70">
            No rows match the current filters.
          </div>
        )}
      </div>
      </div>
    </Card>
    </main>
  );
}

export default Gantt;
