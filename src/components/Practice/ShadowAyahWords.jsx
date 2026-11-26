export default function ShadowAyahWords({ displayTokens = [], words, activeIndex = -1, className = '' }) {
  const tokens =
    displayTokens.length > 0
      ? displayTokens
      : (words || []).map((text, index) => ({ type: 'word', text, index }))

  if (!tokens.length) return null

  return (
    <div className={`shadow-ayah-words arabic ${className}`.trim()} dir="rtl" lang="ar" aria-live="polite">
      {tokens.map((token, i) => {
        if (token.type === 'mark') {
          return (
            <span key={`mark-${token.text}-${i}`} className="shadow-ayah-mark" aria-hidden>
              {token.text}
            </span>
          )
        }
        const idx = token.index
        return (
          <span
            key={`${token.text}-${idx}`}
            className={`shadow-ayah-word ${idx === activeIndex ? 'shadow-ayah-word--active' : ''} ${
              activeIndex >= 0 && idx < activeIndex ? 'shadow-ayah-word--past' : ''
            }`}
            aria-current={idx === activeIndex ? 'true' : undefined}
          >
            {token.text}
          </span>
        )
      })}
    </div>
  )
}