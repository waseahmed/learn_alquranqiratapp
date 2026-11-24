import { useEffect } from 'react'
import { sendLiveQuizHeartbeat } from '../services/liveQuiz'

const INTERVAL_MS = 12000

export function useParticipantHeartbeat(participantId, onRemoved) {
  useEffect(() => {
    if (!participantId) return undefined

    let active = true
    const beat = async () => {
      if (!active) return
      const { error } = await sendLiveQuizHeartbeat(participantId)
      if (
        error &&
        /unknown participant|not found/i.test(error.message || '')
      ) {
        onRemoved?.()
      }
    }
    beat()
    const id = window.setInterval(beat, INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [participantId, onRemoved])
}