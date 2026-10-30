/** New 85% keeps the old minimum; new 120% is the former 100% size. */
export function cardScale(percent: number): number {
  return .85 + (Math.max(85, Math.min(120, percent)) - 85) * .15 / 35;
}

/** Keep old saved settings and malformed storage at the previous audio level. */
export function volumePercent(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.max(0, Math.min(100, value))) : 65;
}
