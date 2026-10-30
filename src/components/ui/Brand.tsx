/** Switrus wordmark with the module name, used in the app header and on sign-in. */
export function Brand() {
  return (
    <>
      <span className="brand-mark" aria-hidden="true">S</span>
      <span className="brand-text">
        <span className="brand-name">Switrus</span>
        <span className="brand-module">User Management</span>
      </span>
    </>
  )
}
