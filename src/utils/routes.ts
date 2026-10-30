/** The route is /users/*: employee IDs contain slashes (SHPL/DEL/0417/2026). */
export function empIdFromPath(splat: string | undefined): string | undefined {
  if (!splat) return undefined
  try {
    return decodeURIComponent(splat)
  } catch {
    return splat
  }
}

/** Record page; `edit` opens the administrator's edit form. */
export const userPath = (empId: string, edit = false) => `/users/${encodeURIComponent(empId)}${edit ? '?edit=1' : ''}`
