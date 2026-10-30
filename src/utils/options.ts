import type { Option } from '../components/ui/Select'

/** One option per value, ignoring case: the API filters case-insensitively, and the
 *  data has spellings like "AIRLINE" and "Airline" for the same department. */
export function distinct(values: (string | null | undefined)[]): Option[] {
  const byKey = new Map<string, string>()
  for (const v of values) {
    const s = v?.trim()
    if (s && !byKey.has(s.toUpperCase())) byKey.set(s.toUpperCase(), s)
  }
  return Array.from(byKey.values())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((v) => ({ value: v, label: v }))
}
