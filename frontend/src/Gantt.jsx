import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Button, Card, Badge, Dropdown, DropdownItem, Spinner, Progress } from 'flowbite-react';
import date_utils from './utils/date_utils';
import { DEFAULT_VIEW_MODES, DEFAULT_OPTIONS } from './utils/gantt_config';

function Gantt() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(DEFAULT_VIEW_MODES[0].name);
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const containerRef = useRef();
  const tooltipWidth = 320;

  const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/tasks`);
      const data = await res.json();
      // normalize dates
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
  }

  function showHoveredTask(task, event) {
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
    if (!tasks.length) return null;

    const starts = tasks.map((t) => t.planned_start);
    const ends = tasks.map((t) => t.planned_due);
    let gantt_start = new Date(Math.min.apply(null, starts));
    let gantt_end = new Date(Math.max.apply(null, ends));

    gantt_start = date_utils.start_of(gantt_start, 'day');
    // extend one day to include end
    gantt_end = date_utils.add(gantt_end, 1, 'day');

    // column width and step (days) based on view mode
    const vm = DEFAULT_VIEW_MODES.find((v) => v.name === viewMode) || DEFAULT_VIEW_MODES[0];
    const columnWidth = vm.column_width || DEFAULT_OPTIONS.column_width || 48;
    // parse step like '1d' or '7d' -> days
    let stepDays = 1;
    if (vm.step && typeof vm.step === 'string' && vm.step.endsWith('d')) {
      stepDays = parseInt(vm.step.replace('d', ''), 10) || 1;
    }

    // columns array stepping by stepDays
    const days = [];
    for (let d = new Date(gantt_start); d <= gantt_end; d = date_utils.add(d, stepDays, 'day')) {
      days.push(new Date(d));
    }

    // bars positions
    const bars = tasks.map((t, i) => {
      const daysFromStart = date_utils.diff(t.planned_start, gantt_start, 'day');
      const durationDays = date_utils.diff(t.planned_due, t.planned_start, 'day') + 1;
      const x = (daysFromStart / stepDays) * columnWidth;
      const w = Math.max(2, (durationDays / stepDays) * columnWidth);
      const y = i * (DEFAULT_OPTIONS.bar_height + DEFAULT_OPTIONS.padding) + DEFAULT_OPTIONS.upper_header_height + 8;
      return { ...t, x, y, w, index: i };
    });

    return { gantt_start, gantt_end, columnWidth, days, bars, width: days.length * columnWidth, rowHeight: DEFAULT_OPTIONS.bar_height + DEFAULT_OPTIONS.padding };
  }, [tasks, viewMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner className="w-12 h-12 md:w-16 md:h-16" />
      </div>
    );
  }

  return (
    <Card className="gantt-card w-full b-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 relative z-50">
          <Dropdown label={`View: ${viewMode}`} inline={true}>
            {DEFAULT_VIEW_MODES.map((m) => (
              <DropdownItem key={m.name} onClick={() => setViewMode(m.name)}>{m.name}</DropdownItem>
            ))}
          </Dropdown>
          <Button size="sm" onClick={() => fetchTasks()}>Refresh</Button>
          <Button size="sm" outline onClick={() => containerRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}>Today</Button>
        </div>
        <div>
          <Badge color="info">{tasks.length} tasks</Badge>
        </div>
      </div>

      <div className="gantt-container h-100 overflow-auto relative z-0" ref={containerRef}>
        {layout ? (
          <div style={{ position: 'relative', minWidth: layout.width, zIndex: 0 }}>
            <svg className="gantt-svg" width={layout.width} height={layout.rowHeight * tasks.length + DEFAULT_OPTIONS.upper_header_height + 40}>
              {/* grid rows */}
              <rect className="grid-background fill-white" x={0} y={0} width={layout.width} height={layout.rowHeight * tasks.length + DEFAULT_OPTIONS.upper_header_height + 40} />
              {layout.days.map((d, i) => {
                let formatStr = 'MM/DD';
                if (viewMode === 'Month') formatStr = 'YY/MM';
                else if (viewMode === 'Week') formatStr = 'MMM DD';
                return (
                  <g key={i}>
                    <text x={i * layout.columnWidth + 4} y={14} className="grid-header text-xs">{date_utils.format(d, formatStr)}</text>
                  </g>
                );
              })}

              {/* bars */}
              {layout.bars.map((b) => (
                <g key={b.task_id}>
                  <foreignObject 
                    x={b.x} 
                    y={b.y} 
                    width={b.w} 
                    height={DEFAULT_OPTIONS.bar_height}
                  >
                    <div className="w-full h-full flex flex-col justify-center">
                      <Progress className='size-xl'
                        progress={b.percent_complete || 0} 
                        size="xl"
                        color="black"
                        className={
                          b.priority === 'High' ? 'bg-sjred' : 
                          b.priority === 'Medium' ? 'bg-sjblue' : 
                          'bg-black/50'
                        }
                      />
                    </div>
                  </foreignObject>
                  
                  {/* label on bar */}
                  <text 
                    x={b.x + 12} 
                    y={b.y + DEFAULT_OPTIONS.bar_height - 6} 
                    className="font-sans text-lg md:text-xl font-medium pointer-events-none"
                    fill="#ffffff" /* Added fill to ensure it contrasts over the progress bar */
                  >
                    {b.task_title}
                  </text>
                </g>
              ))}
              {/* arrows: simple straight lines from end of predecessor to start of successor */}
              {layout.bars.map((b) =>
                (b.dependencies || []).map((predId) => {
                  const pred = layout.bars.find((bb) => bb.task_id === predId);
                  if (!pred) return null;
                  const x1 = pred.x + pred.w;
                  const y1 = pred.y + DEFAULT_OPTIONS.bar_height / 2;
                  const x2 = b.x;
                  const y2 = b.y + DEFAULT_OPTIONS.bar_height / 2;
                  return <line key={`${predId}-${b.task_id}`} x1={x1} y1={y1} x2={x2} y2={y2} className="arrow-line stroke-black stroke-2" />;
                }),
              )}
            </svg>

            {/* HTML overlays for tooltips using Flowbite's Tooltip would require wrapping; instead provide hover card */}
            {layout.bars.map((b) => (
              <div
                key={b.task_id}
                className="bar-hover-overlay absolute cursor-pointer"
                style={{ left: b.x, top: b.y, width: b.w, height: DEFAULT_OPTIONS.bar_height }}
                onMouseEnter={(event) => showHoveredTask(b, event)}
                onMouseLeave={() => {
                  setHovered(null);
                  setTooltipPos(null);
                }}
              />
            ))}

            {hovered && tooltipPos && (
              <div style={{ position: 'absolute', left: tooltipPos.left, top: tooltipPos.top, width: tooltipWidth }} className="gantt-tooltip-card pointer-events-none">
                <Card className="w-full">
                  <div className="text-sm font-semibold">{hovered.task_title}</div>
                  <div className="text-xs">{hovered.owner_name || '—'}</div>
                  <div className="text-xs">{date_utils.format(hovered.planned_start)} → {date_utils.format(hovered.planned_due)}</div>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted">No tasks to display</div>
        )}
      </div>
    </Card>
  );
}

export default Gantt;