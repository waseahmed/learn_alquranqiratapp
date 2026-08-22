import { useCallback, useEffect, useRef, useState } from 'react'

export function useRecorder() {
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const objectUrlRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState(null)
  const [error, setError] = useState(null)

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      cleanupStream()
      revokeUrl()
    },
    [cleanupStream, revokeUrl],
  )

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Recording is not supported in this browser.')
      return false
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('MediaRecorder is not available in this browser.')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        revokeUrl()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setRecordingUrl(url)
        setIsRecording(false)
        cleanupStream()
      }

      recorder.start()
      setIsRecording(true)
      return true
    } catch {
      setError(
        'Microphone access was denied or unavailable. Recording needs HTTPS (or localhost) and permission.',
      )
      cleanupStream()
      setIsRecording(false)
      return false
    }
  }, [cleanupStream, revokeUrl])

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    } else {
      setIsRecording(false)
      cleanupStream()
    }
  }, [cleanupStream])

  const toggle = useCallback(async () => {
    if (isRecording) {
      stop()
      return
    }
    await start()
  }, [isRecording, start, stop])

  return {
    isRecording,
    recordingUrl,
    error,
    start,
    stop,
    toggle,
  }
}
