export default function ShadowAyahWords({ words, activeIndex = -1, className = '' }) {
  if (!words.length) return null
  return (
    <div className={`shadow-ayah-words arabic ${className}`.trim()} dir="rtl" lang="ar" aria-live="polite">
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className={`shadow-ayah-word ${i === activeIndex ? 'shadow-ayah-word--active' : ''} ${
            activeIndex >= 0 && i < activeIndex ? 'shadow-ayah-word--past' : ''
          }`}
          aria-current={i === activeIndex ? 'true' : undefined}
        >
          {w}
        </span>
      ))}
    </div>
  )
}