import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'

export interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder: string
  /** "field" = 150x35 filter bar control, "form" = full-width 40px form control. */
  variant?: 'field' | 'form'
  'aria-label'?: string
  id?: string
}

/** Listbox select: arrow keys (wrap), Home/End, Enter/Space, Esc, Tab, outside click. */
export function Select({ value, onChange, options, placeholder, variant = 'field', id, ...aria }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const choose = (i: number) => {
    const opt = options[i]
    if (opt) onChange(opt.value)
    setOpen(false)
    trigger.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    const n = options.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => (a + 1) % n)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => (a - 1 + n) % n)
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(n - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation() // don't also close a surrounding dialog
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className="select" ref={root}>
      <button
        ref={trigger}
        id={id}
        type="button"
        className={`select-trigger ${variant === 'form' ? 'form' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={aria['aria-label']}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={`label ${selected ? '' : 'placeholder'}`}>{selected?.label ?? placeholder}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <ul className="select-menu" role="listbox" id={listId} aria-label={aria['aria-label']}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`select-option ${i === active ? 'active' : ''}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              {o.label}
              {o.value === value && <Icon name="check" size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
