import { useEffect, useRef, useState } from 'react'

const GET_READY_MS = 1100

/**
 * Brief “get ready” splash when auto-send advances to a new round (not on join mid-question).
 */
export function useLiveQuizGetReadyReveal(roundId, displayPhase, autoSendEnabled) {
  const [visible, setVisible] = useState(false)
  const prevRoundRef = useRef(null)

  useEffect(() => {
    if (!autoSendEnabled) {
      setVisible(false)
      return undefined
    }
    if (displayPhase !== 'question' || !roundId) {
      if (displayPhase === 'waiting') prevRoundRef.current = null
      setVisible(false)
      return undefined
    }

    const prev = prevRoundRef.current
    if (prev === roundId) return undefined

    prevRoundRef.current = roundId

    if (!prev) return undefined

    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), GET_READY_MS)
    return () => window.clearTimeout(t)
  }, [roundId, displayPhase, autoSendEnabled])

  return visible
}