import { useEffect } from 'react'
import LiveQuizLogo from './LiveQuizLogo'

export default function LiveGroupIntroFlash({ groupName, onDismiss, autoMs = 6500 }) {
  useEffect(() => {
    const id = window.setTimeout(() => onDismiss?.(), autoMs)
    return () => window.clearTimeout(id)
  }, [onDismiss, autoMs, groupName])

  return (
    <div className="live-intro-flash" role="dialog" aria-label={`${groupName} is starting`}>
      <div className="live-intro-flash-bg" aria-hidden />
      <div className="live-intro-flash-orbit live-intro-flash-orbit--a" aria-hidden />
      <div className="live-intro-flash-orbit live-intro-flash-orbit--b" aria-hidden />
      <div className="live-intro-flash-card live-intro-flash-card--pop">
        <LiveQuizLogo variant="dark" className="live-intro-flash-logo" />
        <p className="live-intro-flash-eyebrow">Now starting</p>
        <h2 className="live-intro-flash-title">{groupName}</h2>
        <p className="live-intro-flash-sub">Get ready for the next round</p>
        <button type="button" className="btn live-intro-flash-skip" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  )
}