/** JSON parsing alone does not validate values left by older or broken saves. */
export function savedHistory(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .map(Math.sign).slice(-12);
}

export function savedSettings(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
