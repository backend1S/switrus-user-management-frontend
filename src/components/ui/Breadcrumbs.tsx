import { Link } from 'react-router-dom'

/** Users / <current page>. */
export function Crumbs({ label, parent }: { label: string; parent?: { to: string; label: string } }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/users">Users</Link>
      {parent && (
        <>
          <span className="sep" aria-hidden="true">/</span>
          <Link to={parent.to}>{parent.label}</Link>
        </>
      )}
      <span className="sep" aria-hidden="true">/</span>
      <span aria-current="page">{label}</span>
    </nav>
  )
}
