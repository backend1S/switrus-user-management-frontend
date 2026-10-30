import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Horizontal scroll container for wide tables. Scrolling stays inside the
 * table; shaded edges show when columns are hidden to the left or right, and
 * `resetKey` changes (new filters) bring it back to the first column.
 */
export function ScrollTable({ label, resetKey, busy, overlay, children }: {
  label: string
  resetKey?: string
  busy?: boolean
  /** Rendered over the visible area (not the scrolled content), e.g. the loading veil. */
  overlay?: ReactNode
  children: ReactNode
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = wrap.current
    if (!el) return
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }))
  }, [])

  useEffect(() => {
    if (wrap.current) wrap.current.scrollLeft = 0
    measure()
  }, [resetKey, measure])

  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div className="table-scroll" data-more-left={edges.left || undefined} data-more-right={edges.right || undefined}>
      {/* Focusable so keyboard users can scroll it with the arrow keys. */}
      <div ref={wrap} className="table-wrap" role="region" aria-label={label} tabIndex={0} aria-busy={busy} onScroll={measure}>
        {children}
      </div>
      {overlay}
      {edges.right && <span className="sr-only">More columns to the right. Scroll the table to see them.</span>}
    </div>
  )
}
