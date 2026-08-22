import { getAyahAudioUrl } from '../../services/audioService'

export default function QariCard({
  qari,
  surah,
  ayah,
  isPlaying,
  unavailable,
  onReplay,
  onSlow,
  onShadow,
  onAudioError,
  onNativePlay,
}) {
  const src = getAyahAudioUrl(qari.key, surah, ayah)

  return (
    <article className={`card ${isPlaying ? 'playing' : ''}`}>
      <div className="card-head">
        <div className="qname">{qari.name}</div>
        <div className="qstyle">{qari.style}</div>
      </div>
      <div className="card-body">
        <audio
          controls
          preload="none"
          src={unavailable ? undefined : src}
          onPlay={() => onNativePlay?.(qari.key)}
          onError={() => onAudioError(qari.key)}
        />
        {unavailable ? (
          <div className="audio-error" role="status">
            Audio unavailable for this ayah
          </div>
        ) : (
          <div className="card-actions">
            <button type="button" className="btn" onClick={() => onReplay(qari.key)}>
              ↻ Replay
            </button>
            <button type="button" className="btn" onClick={() => onSlow(qari.key)}>
              0.8× Slow
            </button>
            <button type="button" className="btn" onClick={() => onShadow(qari.key)}>
              🎯 Shadow
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
