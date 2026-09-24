import { useEffect, useRef, useState } from 'react'

/** Tap-to-show info bubble — works on touch devices, unlike a hover-only title. */
export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

  return (
    <span className="info-tip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="info-tip-btn"
        aria-label="More info"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⓘ
      </button>
      {open ? (
        <span className="info-tip-bubble" role="tooltip">
          {text}
        </span>
      ) : null}
    </span>
  )
}
