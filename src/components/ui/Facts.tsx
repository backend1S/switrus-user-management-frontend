import type { ReactNode } from 'react'

/** Read-only labelled values. Never an input: saved records are shown, not edited, here. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="facts">{children}</dl>
}

export function Fact({ label, children, sub, wide }: { label: string; children: ReactNode; sub?: ReactNode; wide?: boolean }) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className={`fact ${wide ? 'wide' : ''}`}>
      <dt>{label}</dt>
      <dd>
        {empty ? <span className="muted" aria-label="Not recorded">—</span> : children}
        {sub && <span className="fact-sub">{sub}</span>}
      </dd>
    </div>
  )
}

/** Titled card with a hairline divider, as in every Switrus record page. */
export function InfoCard({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="card card-section" aria-label={title}>
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <span className="grow" />
        {extra}
      </div>
      <hr className="divider" />
      {children}
    </section>
  )
}
