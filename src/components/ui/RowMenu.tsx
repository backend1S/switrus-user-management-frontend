import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { Tooltip } from './Tooltip'

export interface MenuAction {
  label: string
  icon: IconName
  onSelect: () => void
  danger?: boolean
}

/** Row ⋮ menu rendered in a portal so tables never clip it. */
export function RowMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const close = (refocus = true) => {
    setPos(null)
    if (refocus) btn.current?.focus()
  }

  useEffect(() => {
    if (!pos) return
    menu.current?.querySelector<HTMLButtonElement>('.menu-item')?.focus()
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close(false)
    }
    const onScroll = () => close(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [pos])

  const toggle = () => {
    if (pos) return close()
    const r = btn.current!.getBoundingClientRect()
    const height = actions.length * 40 + 20
    const top = r.bottom + 4 + height > window.innerHeight ? r.top - 4 - height : r.bottom + 4
    setPos({ top, left: Math.max(8, r.right - 200) })
  }

  const onKey = (e: KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      close()
    }
  }

  return (
    <>
      <Tooltip content={label}>
        <button
          ref={btn}
          type="button"
          className="icon-btn"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={!!pos}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
        >
          <Icon name="more" size={22} />
        </button>
      </Tooltip>
      {pos &&
        createPortal(
          <div className="menu" role="menu" ref={menu} style={pos} onKeyDown={onKey}>
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                className={`menu-item ${a.danger ? 'danger' : ''}`}
                onClick={() => {
                  close(false)
                  a.onSelect()
                }}
              >
                <Icon name={a.icon} size={20} />
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
