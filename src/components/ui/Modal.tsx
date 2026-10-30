import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  description?: ReactNode
  onClose: () => void
  children?: ReactNode
  footer: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Block closing while a request is in flight. */
  busy?: boolean
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Dialog with focus trap, Esc/backdrop close, scroll lock, focus returned to the opener. */
export function Modal({ title, description, onClose, children, footer, size = 'md', busy }: Props) {
  const titleId = useId()
  const descId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = busy ? () => {} : onClose

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = dialog.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? dialog.current)?.focus()

    const onKey = (e: KeyboardEvent) => {
      // Only the top-most dialog reacts.
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs[dialogs.length - 1] !== dialog.current) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      } else if (e.key === 'Tab' && dialog.current) {
        const items = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (!items.length) return
        const a = items[0]
        const z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className="backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current()
      }}
    >
      <div
        ref={dialog}
        className={`modal ${size === 'md' ? '' : size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div>
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          {description && (
            <p className="modal-text" id={descId}>
              {description}
            </p>
          )}
        </div>
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-footer">{footer}</div>
      </div>
    </div>,
    document.body,
  )
}
