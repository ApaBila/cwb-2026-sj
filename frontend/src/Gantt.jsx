import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Button, Card, Dropdown, DropdownItem, Spinner } from 'flowbite-react';
import date_utils from './utils/date_utils';
import {
  DEFAULT_VIEW_MODES,
  DEFAULT_OPTIONS,
  GANTT_CHART_HEADER_PX,
  GANTT_HEADER_ROW1_PX,
  GANTT_HEADER_ROW2_PX,
  GANTT_HEADER_LINE1_Y,
  GANTT_HEADER_LINE2_Y,
  GANTT_CHART_BODY_BOTTOM_PAD,
} from './utils/gantt_config';
import { ownerInitials } from './utils/initials';
import { sortTasksForGanttLayout } from './utils/gantt_task_order';
import { ganttDependencyPathD } from './utils/gantt_dependency_path';

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

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Two-line timeline header labels per view (matches frozen thead height: row1 + row2).
 * Day: DOW + MM/DD; Week: month abbr + DD; Month: YYYY + month abbr.
 */
function ganttHeaderPair(viewMode, d) {
  if (viewMode === 'Day') {
    return {
      line1: DOW_ABBR[d.getDay()],
      line2: date_utils.format(d, 'MM/DD'),
    };
  }
  if (viewMode === 'Week') {
    return {
      line1: MONTH_ABBR[d.getMonth()],
      line2: String(d.getDate()).padStart(2, '0'),
    };
  }
  if (viewMode === 'Month') {
    return {
      line1: String(d.getFullYear()),
      line2: MONTH_ABBR[d.getMonth()],
    };
  }
  return { line1: '', line2: '' };
}

/** Predecessor / successor rows for tooltip (`inChart` → link scrolls within current layout). */
function predSuccDetails(bar, bars) {
  const predIds = bar.dependencies || [];
  const preds = predIds.map((id) => {
    const p = bars.find((x) => x.task_id === id);
    return { taskId: id, label: p?.task_title || id, inChart: !!p };
  });
  const succs = bars
    .filter((b) => (b.dependencies || []).includes(bar.task_id))
    .map((b) => ({ taskId: b.task_id, label: b.task_title || b.task_id, inChart: true }));
  return { preds, succs };
}

function Gantt() {
  const [tasks, setTasks] = useState([]);
  const [draftsCount, setDraftsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(DEFAULT_VIEW_MODES[0].name);
  /** Bar under pointer (cleared on mouse leave unless a bar is pinned). */
  const [hoveredBar, setHoveredBar] = useState(null);
  /** Pinned bar id: tooltip stays open until click-away or toggle. */
  const [pinnedBarId, setPinnedBarId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [columnFilters, setColumnFilters] = useState({
    project_id: '',
    task_title: '',
    owner_name: '',
  });
  /** 1-based row range visible in the body scroller (must stay above useMemo for hook order). */
  const [visibleRows, setVisibleRows] = useState({ start: 1, end: 1 });
  /** Body region: vertical + horizontal scroll (tooltip + visible-row summary). */
  const bodyScrollRef = useRef(null);
  /** Timeline header: horizontal scroll only, kept in sync with body horizontal scroll. */
  const headerScrollRef = useRef(null);
  /** Scroll-to-task implementation (ref avoids eslint ref-in-render on JSX handlers). */
  const scrollToBarByIdRef = useRef(() => {});
  const tooltipWidth = 320;

  const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';

  const fetchDraftsCount = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/drafts`);
      if (!res.ok) return;
      const data = await res.json();
      setDraftsCount(Array.isArray(data) ? data.length : 0);
    } catch (e) {
      console.error('Failed to fetch drafts count', e);
    }
  }, [apiBaseUrl]);

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

  const refreshData = useCallback(() => {
    void fetchTasks();
    void fetchDraftsCount();
  }, [fetchTasks, fetchDraftsCount]);

  useEffect(() => {
    const t = setTimeout(() => {
      refreshData();
    }, 0);
    return () => clearTimeout(t);
  }, [refreshData]);

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

  const positionTooltip = useCallback((task) => {
    const container = bodyScrollRef.current;
    if (!container) {
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
    if (top + 220 > visibleBottom) {
      top = Math.max(visibleTop + padding, visibleBottom - 220 - padding);
    }

    setTooltipPos({ left, top });
  }, [tooltipWidth]);

  function showHoveredTask(task) {
    if (pinnedBarId != null && String(task.task_id) !== String(pinnedBarId)) {
      return;
    }
    setHoveredBar(task);
    positionTooltip(task);
  }

  const layout = useMemo(() => {
    if (!filteredTasks.length) return null;

    /** Project → start date → due → id (strict; deps do not reorder rows). */
    const orderedTasks = sortTasksForGanttLayout(filteredTasks);

    const starts = orderedTasks.map((t) => t.planned_start);
    const ends = orderedTasks.map((t) => t.planned_due);
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

    const barH = DEFAULT_OPTIONS.bar_height;
    const rowHeight = barH + DEFAULT_OPTIONS.padding;
    const bars = orderedTasks.map((t, i) => {
      const daysFromStart = date_utils.diff(t.planned_start, gantt_start, 'day');
      const durationDays = date_utils.diff(t.planned_due, t.planned_start, 'day') + 1;
      const x = (daysFromStart / stepDays) * columnWidth;
      const w = Math.max(2, (durationDays / stepDays) * columnWidth);
      const y = i * rowHeight + (rowHeight - barH) / 2;
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

  useLayoutEffect(() => {
    scrollToBarByIdRef.current = (taskId) => {
      if (!layout) return;
      const sid = String(taskId);
      const target = layout.bars.find((b) => String(b.task_id) === sid);
      const body = bodyScrollRef.current;
      const head = headerScrollRef.current;
      if (!target || !body) return;

      const rh = layout.rowHeight;
      const rowTop = target.index * rh;
      const centerY = rowTop + rh / 2 - body.clientHeight / 2;
      const maxTop = Math.max(0, body.scrollHeight - body.clientHeight);
      body.scrollTop = Math.min(Math.max(0, centerY), maxTop);

      const centerX = target.x + target.w / 2 - body.clientWidth / 2;
      const maxLeft = Math.max(0, body.scrollWidth - body.clientWidth);
      const newLeft = Math.min(Math.max(0, centerX), maxLeft);
      body.scrollLeft = newLeft;
      if (head) head.scrollLeft = newLeft;

      setPinnedBarId((curPin) => (curPin ? taskId : curPin));
      setHoveredBar(target);
      positionTooltip(target);
    };
  }, [layout, positionTooltip]);

  const onTooltipDepNavClick = useCallback((e) => {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-gantt-nav-task-id');
    if (id) scrollToBarByIdRef.current(id);
  }, []);

  const tooltipBar = useMemo(() => {
    if (!layout) return null;
    const pinned = pinnedBarId ? layout.bars.find((b) => b.task_id === pinnedBarId) : null;
    return pinned ?? hoveredBar;
  }, [layout, pinnedBarId, hoveredBar]);

  const rowHighlight = useMemo(() => {
    if (!layout) return { primaryId: null, predIds: new Set(), succIds: new Set() };
    const primary = pinnedBarId
      ? layout.bars.find((b) => b.task_id === pinnedBarId) ?? null
      : hoveredBar;
    if (!primary) return { primaryId: null, predIds: new Set(), succIds: new Set() };
    const predIds = new Set(primary.dependencies || []);
    const succIds = new Set(
      layout.bars
        .filter((b) => (b.dependencies || []).includes(primary.task_id))
        .map((b) => b.task_id),
    );
    return { primaryId: primary.task_id, predIds, succIds };
  }, [layout, pinnedBarId, hoveredBar]);

  useLayoutEffect(() => {
    if (tooltipBar) positionTooltip(tooltipBar);
  }, [tooltipBar, positionTooltip]);

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || !tooltipBar) return;
    const onScroll = () => positionTooltip(tooltipBar);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [tooltipBar, positionTooltip]);

  useEffect(() => {
    if (!pinnedBarId) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setPinnedBarId(null);
    };
    const onDoc = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.gantt-tooltip-card') || t.closest('.bar-hover-overlay')) return;
      setPinnedBarId(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [pinnedBarId]);

  useEffect(() => {
    if (!pinnedBarId || !layout || layout.bars.some((b) => b.task_id === pinnedBarId)) return;
    const t = window.setTimeout(() => {
      setPinnedBarId(null);
      setTooltipPos(null);
    }, 0);
    return () => clearTimeout(t);
  }, [layout, pinnedBarId]);

  useLayoutEffect(() => {
    if (!layout) return;
    const n = layout.bars.length;
    const rh = layout.rowHeight;
    const el = bodyScrollRef.current;
    if (!el) return;
    const update = () => {
      if (n === 0 || rh <= 0) {
        setVisibleRows({ start: 0, end: 0 });
        return;
      }
      const st = el.scrollTop;
      const ch = el.clientHeight;
      let i0 = Math.floor(st / rh);
      let i1 = Math.ceil((st + ch) / rh) - 1;
      i0 = Math.max(0, Math.min(n - 1, i0));
      i1 = Math.max(0, Math.min(n - 1, i1));
      if (i1 < i0) i1 = i0;
      setVisibleRows({ start: i0 + 1, end: i1 + 1 });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [layout, layout?.bars?.length, layout?.rowHeight]);

  /** Keep timeline header and chart body aligned horizontally (header sits outside vertical scroll). */
  useEffect(() => {
    const body = bodyScrollRef.current;
    const head = headerScrollRef.current;
    if (!layout || !body || !head) return;
    const onBody = () => {
      head.scrollLeft = body.scrollLeft;
    };
    const onHead = () => {
      body.scrollLeft = head.scrollLeft;
    };
    head.scrollLeft = body.scrollLeft;
    body.addEventListener('scroll', onBody, { passive: true });
    head.addEventListener('scroll', onHead, { passive: true });
    return () => {
      body.removeEventListener('scroll', onBody);
      head.removeEventListener('scroll', onHead);
    };
  }, [layout, viewMode]);

  if (loading) {
    return (
      <main className="gantt-page items-center justify-center">
        <Spinner className="h-10 w-10 md:h-12 md:w-12" />
      </main>
    );
  }

  const bodySvgHeight =
    layout != null
      ? layout.bars.length * layout.rowHeight + GANTT_CHART_BODY_BOTTOM_PAD
      : 0;

  return (
    <main className="gantt-page bg-white">
    <Card className="gantt-card flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-white p-4 shadow-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="gantt-scroll-frame">
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
          <Button pill size="xl" onClick={() => refreshData()}>Refresh</Button>
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
              <span className="text-black/80">Viewing rows </span>
              <strong className="font-semibold text-black">
                {visibleRows.start}–{visibleRows.end}
              </strong>
              <span className="text-black/80"> of </span>
              <strong className="font-semibold text-black">{layout.bars.length}</strong>
              <span className="text-black/80"> shown · </span>
              <strong className="font-semibold text-black">{draftsCount}</strong>
              <span className="text-black/80">
                {' '}
                draft{draftsCount === 1 ? '' : 's'} waiting
              </span>
              {hasFilters ? (
                <span className="text-black/70"> (column filters)</span>
              ) : null}
            </p>
          ) : tasks.length > 0 ? (
            <p className="sj-text-h2 m-0 text-black/70">No rows match the current filters.</p>
          ) : (
            <p className="sj-text-h2 m-0 text-black">
              <strong className="font-semibold text-black">{draftsCount}</strong>
              <span className="text-black/80">
                {' '}
                draft{draftsCount === 1 ? '' : 's'} waiting
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="gantt-chart-root relative z-0 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden border border-black/10 bg-white">
        {layout ? (
          <>
            {/* Fixed-height header: thead + timeline (horizontal scroll synced with body). */}
            <div className="flex min-h-0 min-w-0 shrink-0 items-stretch border-b border-black/10 bg-white">
              <div
                className="shrink-0 border-r border-black/10 bg-white"
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
                ref={headerScrollRef}
                className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
              >
                <div
                  className="relative shrink-0 bg-white"
                  style={{ width: layout.width, height: GANTT_CHART_HEADER_PX }}
                >
                  <svg
                    className="gantt-svg-header block"
                    width={layout.width}
                    height={GANTT_CHART_HEADER_PX}
                    aria-hidden
                  >
                    <rect className="fill-white" x={0} y={0} width={layout.width} height={GANTT_CHART_HEADER_PX} />
                    {layout.days.map((d, i) => {
                      const { line1, line2 } = ganttHeaderPair(viewMode, d);
                      const cx = i * layout.columnWidth + layout.columnWidth / 2;
                      return (
                        <g key={i}>
                          <text
                            x={cx}
                            y={GANTT_HEADER_LINE1_Y}
                            textAnchor="middle"
                            className="gantt-header-line1"
                          >
                            {line1}
                          </text>
                          <text
                            x={cx}
                            y={GANTT_HEADER_LINE2_Y}
                            textAnchor="middle"
                            className="gantt-header-line2"
                          >
                            {line2}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            {/* Body fills remaining viewport height; only this region scrolls vertically. */}
            <div
              ref={bodyScrollRef}
              className="gantt-body-scroll min-h-0 min-w-0 flex-1 basis-0 overflow-auto"
            >
            <div className="flex min-w-min items-stretch">
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-black/10 bg-white"
                style={{ width: FROZEN_PANEL_WIDTH }}
              >
                <table className="w-full table-fixed text-left text-black">
                  {FROZEN_COLGROUP}
                  <tbody className="font-sans text-sj-body text-black">
                    {layout.bars.map((b) => {
                      const isPri = b.task_id === rowHighlight.primaryId;
                      const isPred = rowHighlight.predIds.has(b.task_id);
                      const isSucc = rowHighlight.succIds.has(b.task_id);
                      let trCls = 'border-b border-black/5 transition-colors ';
                      if (isPri) trCls += 'bg-sjblue/15 ring-1 ring-inset ring-sjblue/30';
                      else if (isPred || isSucc) trCls += 'bg-sjblue/10';
                      else trCls += 'hover:bg-black/5';
                      return (
                      <tr
                        key={`frozen-${b.task_id}`}
                        className={trCls}
                        style={{ height: layout.rowHeight }}
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
                    );
                    })}
                  </tbody>
                </table>
              </div>
              <div
                className="relative shrink-0"
                style={{ minWidth: layout.width, height: bodySvgHeight }}
              >
                <svg
                  className="gantt-svg pointer-events-none absolute left-0 top-0 z-0 block"
                  width={layout.width}
                  height={bodySvgHeight}
                  style={{ zIndex: 0 }}
                  aria-hidden
                >
                  {viewMode === 'Day' && (
                    <defs>
                      <marker
                        id="gantt-dep-arrow"
                        viewBox="0 0 10 10"
                        refX={9}
                        refY={5}
                        markerWidth={10}
                        markerHeight={10}
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" className="gantt-dep-arrowhead" />
                      </marker>
                    </defs>
                  )}
                  <rect
                    className="grid-background fill-white"
                    x={0}
                    y={0}
                    width={layout.width}
                    height={bodySvgHeight}
                  />
                  <g className="gantt-body-grid" aria-hidden>
                    {Array.from({ length: layout.days.length + 1 }, (_, i) => (
                      <line
                        key={`v-${i}`}
                        className="gantt-grid-line"
                        x1={i * layout.columnWidth}
                        y1={0}
                        x2={i * layout.columnWidth}
                        y2={bodySvgHeight}
                      />
                    ))}
                    {Array.from({ length: layout.bars.length + 1 }, (_, j) => (
                      <line
                        key={`h-${j}`}
                        className="gantt-grid-line"
                        x1={0}
                        y1={j * layout.rowHeight}
                        x2={layout.width}
                        y2={j * layout.rowHeight}
                      />
                    ))}
                  </g>
                  {viewMode === 'Day' && (
                    <g className="gantt-dependencies" aria-hidden>
                      {layout.bars.map((b) =>
                        (b.dependencies || []).map((predId) => {
                          const pred = layout.bars.find((bb) => bb.task_id === predId);
                          if (!pred) return null;
                          const d = ganttDependencyPathD(
                            pred,
                            b,
                            DEFAULT_OPTIONS.bar_height,
                          );
                          return (
                            <path
                              key={`${predId}-${b.task_id}`}
                              d={d}
                              className="gantt-dependency-link"
                              markerEnd="url(#gantt-dep-arrow)"
                            />
                          );
                        }),
                      )}
                    </g>
                  )}
                  {/*
                    Native SVG rects (not Flowbite Progress) so stroke + markers paint first;
                    opaque fills sit above dependency paths in document order (avoids SVG/HTML compositing).
                  */}
                  <g className="gantt-bars" aria-hidden>
                    {layout.bars.map((b) => {
                      const bh = DEFAULT_OPTIONS.bar_height;
                      const pillR = bh / 2;
                      const pct = Math.min(100, Math.max(0, Number(b.percent_complete) || 0));
                      const fillW = Math.max(0, (b.w * pct) / 100);
                      const fillRx = Math.min(pillR, fillW / 2);
                      const fillClass =
                        b.priority === 'High'
                          ? 'gantt-bar-fill--high'
                          : b.priority === 'Medium'
                            ? 'gantt-bar-fill--medium'
                            : 'gantt-bar-fill--low';
                      return (
                        <g key={`bar-${b.task_id}`} transform={`translate(${b.x},${b.y})`}>
                          <rect width={b.w} height={bh} rx={pillR} ry={pillR} className="gantt-bar-track" />
                          {fillW > 0 ? (
                            <rect
                              width={fillW}
                              height={bh}
                              rx={fillRx}
                              ry={pillR}
                              className={fillClass}
                            />
                          ) : null}
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {layout.bars.map((b) => (
                  <div
                    key={b.task_id}
                    className="bar-hover-overlay absolute z-[30] cursor-pointer"
                    style={{ left: b.x, top: b.y, width: b.w, height: DEFAULT_OPTIONS.bar_height }}
                    onMouseEnter={() => showHoveredTask(b)}
                    onMouseLeave={(e) => {
                      const rel = e.relatedTarget;
                      if (rel instanceof Element && rel.closest('.gantt-tooltip-card')) return;
                      setHoveredBar(null);
                      if (!pinnedBarId) setTooltipPos(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedBarId((cur) => {
                        if (cur === b.task_id) {
                          setTooltipPos(null);
                          return null;
                        }
                        return b.task_id;
                      });
                    }}
                  />
                ))}

                {tooltipBar && tooltipPos && layout && (() => {
                  const { preds, succs } = predSuccDetails(tooltipBar, layout.bars);
                  const pinnedHere = pinnedBarId === tooltipBar.task_id;
                  return (
                  <div
                    style={{ position: 'absolute', left: tooltipPos.left, top: tooltipPos.top, width: tooltipWidth }}
                    className="gantt-tooltip-card pointer-events-auto z-[40]"
                  >
                    <Card className="w-full rounded-none border border-black/10 bg-white p-3 shadow-none">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 font-sans text-sj-body text-black">
                          <div>{tooltipBar.owner_name || '—'}</div>
                          <div className="mt-1">
                            {date_utils.format(tooltipBar.planned_start)} →{' '}
                            {date_utils.format(tooltipBar.planned_due)}
                          </div>
                          <div className="mt-2 font-semibold text-black/70">Predecessors</div>
                          <div className="break-words">
                            {preds.length === 0 ? (
                              '—'
                            ) : (
                              preds.map((p, i) => (
                                <span key={p.taskId}>
                                  {i > 0 ? (
                                    <span aria-hidden="true" className="text-black/35">
                                      {' · '}
                                    </span>
                                  ) : null}
                                  {p.inChart ? (
                                    <button
                                      type="button"
                                      data-gantt-nav-task-id={String(p.taskId)}
                                      className="cursor-pointer text-left font-sans text-sj-body font-normal text-sjblue underline decoration-2 underline-offset-2 hover:text-sjred"
                                      onClick={onTooltipDepNavClick}
                                    >
                                      {p.label}
                                    </button>
                                  ) : (
                                    <span className="text-black/60">{p.label}</span>
                                  )}
                                </span>
                              ))
                            )}
                          </div>
                          <div className="mt-1 font-semibold text-black/70">Successors</div>
                          <div className="break-words">
                            {succs.length === 0 ? (
                              '—'
                            ) : (
                              succs.map((s, i) => (
                                <span key={s.taskId}>
                                  {i > 0 ? (
                                    <span aria-hidden="true" className="text-black/35">
                                      {' · '}
                                    </span>
                                  ) : null}
                                  {s.inChart ? (
                                    <button
                                      type="button"
                                      data-gantt-nav-task-id={String(s.taskId)}
                                      className="cursor-pointer text-left font-sans text-sj-body font-normal text-sjblue underline decoration-2 underline-offset-2 hover:text-sjred"
                                      onClick={onTooltipDepNavClick}
                                    >
                                      {s.label}
                                    </button>
                                  ) : (
                                    <span className="text-black/60">{s.label}</span>
                                  )}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        {pinnedHere ? (
                          <button
                            type="button"
                            className="shrink-0 font-sans text-sj-body font-semibold text-sjblue underline decoration-2 underline-offset-2 hover:text-sjred"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPinnedBarId(null);
                              setTooltipPos(null);
                            }}
                          >
                            Close
                          </button>
                        ) : null}
                      </div>
                      {!pinnedHere ? (
                        <p className="mb-0 mt-2 font-sans text-sj-body text-black/50">Click bar to pin</p>
                      ) : null}
                    </Card>
                  </div>
                  );
                })()}
              </div>
            </div>
            </div>
          </>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 text-center font-sans text-sj-body text-black/70">
            No tasks to display
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-6 text-center font-sans text-sj-body text-black/70">
            No rows match the current filters.
          </div>
        )}
      </div>
      </div>
      </div>
    </Card>
    </main>
  );
}

export default Gantt;
