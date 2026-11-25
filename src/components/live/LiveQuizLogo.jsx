import { useState } from 'react'

const LIGHT_LOGO = 'aqqa-logo.png'
const DARK_LOGO = 'aqqa-logo-gold.png'

/**
 * @param {'light' | 'dark'} variant — light pages use the dark ink logo; dark pages use gold.
 */
export default function LiveQuizLogo({ variant = 'light', className = '', alt = 'Al Quran Qirat Academy' }) {
  const primary = variant === 'dark' ? DARK_LOGO : LIGHT_LOGO
  const fallback = variant === 'dark' ? LIGHT_LOGO : DARK_LOGO
  const [src, setSrc] = useState(`${import.meta.env.BASE_URL}${primary}`)

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        setSrc(`${import.meta.env.BASE_URL}${fallback}`)
      }}
    />
  )
}