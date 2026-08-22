export default function RecordingPanel({ recordingUrl, error }) {
  if (!recordingUrl && !error) return null

  if (error) {
    return (
      <div className="recording show" role="alert">
        {error}
      </div>
    )
  }

  return (
    <div className="recording show">
      <b>Your recording</b>
      <br />
      <audio controls src={recordingUrl} preload="metadata" />
    </div>
  )
}
