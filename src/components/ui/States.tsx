import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function EmptyState({
  icon = 'users',
  title,
  text,
  actions,
}: {
  icon?: IconName
  title: string
  text?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="empty" role="status">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-inline" role="alert">
      <Icon name="alert" size={18} />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn-link" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function LoadingVeil({ label = 'Updating' }: { label?: string }) {
  return (
    <div className="loading-veil" role="status">
      <div className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Bone({ w, h = 12, radius }: { w: number | string; h?: number; radius?: number }) {
  return <span className="bone" style={{ width: w, height: h, borderRadius: radius }} aria-hidden="true" />
}

export function StatusPill({ tone, children }: { tone: 'ok' | 'wait' | 'info' | 'danger' | 'ended'; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function Callout({
  tone,
  icon,
  children,
}: {
  tone: 'warn' | 'info' | 'error' | 'ok'
  icon?: IconName
  children: ReactNode
}) {
  const fallback: Record<string, IconName> = { warn: 'alert', info: 'info', error: 'alert', ok: 'check' }
  return (
    <div className={`callout callout-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon ?? fallback[tone]} size={16} />
      <div>{children}</div>
    </div>
  )
}
