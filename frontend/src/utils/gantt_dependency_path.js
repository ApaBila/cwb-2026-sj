/**
 * Orthogonal finish-to-start links (no diagonals).
 *
 * **Normal case** (`predEnd <= succStart`): exit at predecessor **finish**, **down** to the
 * successor row, **right** to `succ.x`.
 *
 * **Overlap**: along the predecessor row to `succ.x`, then **down**.
 *
 * @param {{ x: number, y: number, w: number }} pred
 * @param {{ x: number, y: number, w: number }} succ
 * @param {number} barHeight
 * @returns {string} SVG path `d` attribute
 */
export function ganttDependencyPathD(pred, succ, barHeight) {
  const half = barHeight / 2;
  const y1 = pred.y + half;
  const y2 = succ.y + half;
  const predEnd = pred.x + pred.w;
  const succStart = succ.x;

  const eps = 0.5;
  const sameY = Math.abs(y1 - y2) < eps;

  if (sameY) {
    if (Math.abs(predEnd - succStart) < eps) {
      return `M ${predEnd} ${y1} h 0`;
    }
    return `M ${predEnd} ${y1} L ${succStart} ${y1}`;
  }

  const forward = predEnd <= succStart + eps;

  if (forward) {
    if (Math.abs(predEnd - succStart) < eps) {
      return `M ${predEnd} ${y1} L ${predEnd} ${y2}`;
    }
    return `M ${predEnd} ${y1} L ${predEnd} ${y2} L ${succStart} ${y2}`;
  }

  if (Math.abs(predEnd - succStart) < eps) {
    return `M ${predEnd} ${y1} L ${predEnd} ${y2}`;
  }
  return `M ${predEnd} ${y1} L ${succStart} ${y1} L ${succStart} ${y2}`;
}
