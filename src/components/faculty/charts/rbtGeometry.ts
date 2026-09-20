/** Screen-space angles (deg, y-down) for the 6 radar vertices, Remember at top. */
export const RBT_RADAR_ANGLES = [270, 330, 30, 90, 150, 210];

/** Resolve a cursor to the nearest RBT level by angular sector. */
export function resolveRbtSectorIndex(
  cursor: { x: number; y: number },
  center: { x: number; y: number },
  angles: number[] = RBT_RADAR_ANGLES,
): number {
  const dx = cursor.x - center.x;
  const dy = cursor.y - center.y;
  if (dx === 0 && dy === 0) return 0;
  let cursorAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (cursorAngle < 0) cursorAngle += 360;
  let best = 0;
  let bestDiff = Infinity;
  angles.forEach((angle, i) => {
    let diff = Math.abs(angle - cursorAngle);
    if (diff > 180) diff = 360 - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}
