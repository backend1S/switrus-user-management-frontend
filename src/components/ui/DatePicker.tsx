import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatDate, parseISODate, toISODate, todayIST } from '../../utils/format'
import { Icon } from './Icon'

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface Props {
  id?: string
  value: string // YYYY-MM-DD or ''
  onChange: (v: string) => void
  placeholder?: string
  invalid?: boolean
  min?: string
  /** Other end of a range, to shade the days between. */
  rangeWith?: string
  'aria-describedby'?: string
}

function addDays(iso: string, n: number) {
  const d = parseISODate(iso)!
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** The single date picker: ISO internally, DD/MM/YYYY shown, calendar in a fixed portal. */
export function DatePicker({ id, value, onChange, placeholder = 'DD/MM/YYYY', invalid, min, rangeWith, ...rest }: Props) {
  const today = todayIST()
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(value || today)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const trigger = useRef<HTMLButtonElement>(null)
  const cal = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect()
    if (!r) return
    const h = 320
    const top = r.bottom + 4 + h > window.innerHeight && r.top - 4 - h > 0 ? r.top - 4 - h : r.bottom + 4
    setPos({ top, left: Math.min(Math.max(8, r.left), window.innerWidth - 260) })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!cal.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  useEffect(() => {
    if (open) cal.current?.querySelector<HTMLButtonElement>('.cal-day.focused')?.focus()
  }, [open, focus])

  const openCal = () => {
    setFocus(value || (min && min > today ? min : today))
    setOpen(true)
  }
  const pick = (iso: string) => {
    if (min && iso < min) return
    onChange(iso)
    setOpen(false)
    trigger.current?.focus()
  }

  const f = parseISODate(focus) ?? new Date()
  const first = new Date(f.getFullYear(), f.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toISODate(d)
  })
  const lo = rangeWith && value ? (rangeWith < value ? rangeWith : value) : null
  const hi = rangeWith && value ? (rangeWith < value ? value : rangeWith) : null

  const onGridKey = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in moves) {
      e.preventDefault()
      setFocus(addDays(focus, moves[e.key]))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      const d = parseISODate(focus)!
      d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1))
      setFocus(toISODate(d))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // don't also close a surrounding dialog
      setOpen(false)
      trigger.current?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(focus)
    }
  }

  const shiftMonth = (n: number) => {
    const d = new Date(f.getFullYear(), f.getMonth() + n, 1)
    setFocus(toISODate(d))
  }

  return (
    <div className="input-wrap">
      <button
        ref={trigger}
        id={id}
        type="button"
        className="date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={rest['aria-describedby']}
        onClick={() => (open ? setOpen(false) : openCal())}
      >
        <Icon name="calendar" size={14} />
        <span className={value ? '' : 'placeholder'}>{value ? formatDate(value) : placeholder}</span>
      </button>
      {value && (
        <button type="button" className="icon-btn date-clear" aria-label="Clear date" onClick={() => onChange('')}>
          <Icon name="x" size={14} />
        </button>
      )}
      {open &&
        createPortal(
          <div className="calendar" ref={cal} role="dialog" aria-label="Choose date" style={pos}>
            <div className="cal-head">
              <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                <Icon name="chevronLeft" size={18} />
              </button>
              <span aria-live="polite">
                {MONTHS[f.getMonth()]} {f.getFullYear()}
              </span>
              <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shiftMonth(1)}>
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
            <div className="cal-grid" role="grid" onKeyDown={onGridKey}>
              {DOW.map((d) => (
                <div key={d} className="cal-dow" role="columnheader">
                  {d}
                </div>
              ))}
              {days.map((iso) => {
                const d = parseISODate(iso)!
                const disabled = !!min && iso < min
                const cls = [
                  'cal-day',
                  d.getMonth() !== f.getMonth() && 'outside',
                  iso === today && 'today',
                  lo && hi && iso > lo && iso < hi && 'in-range',
                  rangeWith && iso === rangeWith && iso !== value && 'range-end',
                  iso === value && 'selected',
                  iso === focus && 'focused',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    className={cls}
                    tabIndex={iso === focus ? 0 : -1}
                    disabled={disabled}
                    style={disabled ? { color: 'rgba(0,0,0,.2)', cursor: 'not-allowed' } : undefined}
                    aria-selected={iso === value}
                    aria-label={formatDate(iso)}
                    onClick={() => pick(iso)}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="cal-foot">
              <button type="button" className="btn-link" onClick={() => pick(today)} disabled={!!min && today < min}>
                Today
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                Clear
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
