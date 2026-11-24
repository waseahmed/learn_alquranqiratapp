import { useEffect } from 'react'
import { sendLiveQuizHeartbeat } from '../services/liveQuiz'

const INTERVAL_MS = 12000

export function useParticipantHeartbeat(participantId) {
  useEffect(() => {
    if (!participantId) return undefined

    let active = true
    const beat = () => {
      if (active) sendLiveQuizHeartbeat(participantId)
    }
    beat()
    const id = window.setInterval(beat, INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [participantId])
}