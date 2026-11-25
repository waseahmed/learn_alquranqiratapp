import { useEffect } from 'react'

export default function LiveSlideDrawer({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="live-drawer-backdrop live-drawer-backdrop--open"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className="live-drawer live-drawer--open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-drawer-title"
      >
        <header className="live-drawer-header">
          <h2 id="live-drawer-title" className="live-drawer-title">
            {title}
          </h2>
          <button type="button" className="live-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="live-drawer-body">{children}</div>
        {footer && <footer className="live-drawer-footer">{footer}</footer>}
      </aside>
    </>
  )
}