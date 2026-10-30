import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'

interface Props {
  content: ReactNode
  children: ReactElement<Record<string, unknown>>
  /** Only show when the child's text is actually truncated. */
  onlyWhenTruncated?: boolean
}

/**
 * The one tooltip: 250ms delay, hover and keyboard focus, Esc hides, flips
 * above/below to fit, never the native title attribute.
 */
export function Tooltip({ content, children, onlyWhenTruncated }: Props) {
  const id = useId()
  const anchor = useRef<HTMLElement | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)

  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    setPos(null)
  }, [])

  const show = useCallback(() => {
    const el = anchor.current
    if (!el || content === null || content === undefined || content === '') return
    if (onlyWhenTruncated && el.scrollWidth <= el.clientWidth) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      const above = r.bottom + 60 > window.innerHeight
      const left = Math.min(Math.max(8, r.left + r.width / 2 - 150), window.innerWidth - 308)
      setPos({ top: above ? r.top - 8 : r.bottom + 8, left: Math.max(8, left), above })
    }, 250)
  }, [content, onlyWhenTruncated])

  useEffect(() => {
    if (!pos) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [pos, hide])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!isValidElement(children)) return children
  const childProps = children.props as Record<string, (...a: unknown[]) => void>
  const chain = (name: string, fn: () => void) => (...args: unknown[]) => {
    childProps[name]?.(...args)
    fn()
  }
  // React 19: ref is a prop, and cloneElement's ref replaces it. Keep the
  // child's own ref working (RowMenu measures its button through it).
  const childRef = (children.props as { ref?: Ref<HTMLElement> }).ref

  return (
    <>
      {cloneElement(children, {
        ref: (node: HTMLElement | null) => {
          anchor.current = node
          if (typeof childRef === 'function') childRef(node)
          else if (childRef) (childRef as { current: HTMLElement | null }).current = node
        },
        onMouseEnter: chain('onMouseEnter', show),
        onMouseLeave: chain('onMouseLeave', hide),
        onFocus: chain('onFocus', show),
        onBlur: chain('onBlur', hide),
        'aria-describedby': pos ? id : (children.props['aria-describedby'] as string | undefined),
      })}
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="tooltip"
            style={{ top: pos.top, left: pos.left, transform: pos.above ? 'translateY(-100%)' : undefined }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
