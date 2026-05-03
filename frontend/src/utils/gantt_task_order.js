/**
 * Order Gantt rows: **project** → **planned_start** → **planned_due** → **task_id**.
 *
 * Rows are a strict schedule list — dependency links are drawn separately and do **not**
 * reorder rows (topological sort would pull predecessors above tasks that start earlier).
 */

/** @param {Date} a @param {Date} b */
function dateMs(a, b) {
  return a.getTime() - b.getTime();
}

/**
 * @param {{ planned_start: Date, planned_due: Date, task_id: string }} a
 * @param {{ planned_start: Date, planned_due: Date, task_id: string }} b
 */
function compareStartDueId(a, b) {
  const s = dateMs(a.planned_start, b.planned_start);
  if (s !== 0) return s;
  const d = dateMs(a.planned_due, b.planned_due);
  if (d !== 0) return d;
  return String(a.task_id).localeCompare(String(b.task_id), undefined, {
    numeric: true,
  });
}

/**
 * @param {Array<Record<string, unknown> & { task_id: string, planned_start: Date, planned_due: Date, project_id?: string, dependencies?: string[] }>} tasks
 */
export function sortTasksForGanttLayout(tasks) {
  if (!tasks.length) return [];

  /** @type {Map<string, typeof tasks>} */
  const byProject = new Map();
  for (const t of tasks) {
    const k = String(t.project_id ?? '');
    if (!byProject.has(k)) byProject.set(k, []);
    byProject.get(k).push(t);
  }

  const projectKeys = [...byProject.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );

  /** @type {typeof tasks} */
  const ordered = [];
  for (const pk of projectKeys) {
    const group = byProject.get(pk);
    if (group) ordered.push(...[...group].sort(compareStartDueId));
  }
  return ordered;
}
