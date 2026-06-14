/** Combine hub status lines without duplicating text. */
export function appendStatus(base: string, extra?: string): string {
  if (!extra || base.includes(extra)) return base
  return `${base} ${extra}`
}
