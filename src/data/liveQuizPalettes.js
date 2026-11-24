/** Muted, readable palettes — no neon/fluorescent. */
export const LIVE_QUIZ_PALETTES = [
  {
    name: 'Olive garden',
    panelBg: '#f4f7ef',
    panelBorder: '#5d8f59',
    accent: '#1e6039',
    btnBg: '#edf4e8',
    btnBorder: '#5d8f59',
    btnText: '#193322',
    btnActiveBg: '#1e6039',
    btnActiveText: '#fff',
    timer: '#1e6039',
  },
  {
    name: 'Sand & gold',
    panelBg: '#faf6ef',
    panelBorder: '#b8923a',
    accent: '#8b6914',
    btnBg: '#f7f0e4',
    btnBorder: '#c99334',
    btnText: '#3d3018',
    btnActiveBg: '#8b6914',
    btnActiveText: '#fffaf2',
    timer: '#8b6914',
  },
  {
    name: 'Soft teal',
    panelBg: '#f2f8f8',
    panelBorder: '#4a8f8c',
    accent: '#2d5f5c',
    btnBg: '#e8f4f3',
    btnBorder: '#4a8f8c',
    btnText: '#1a3331',
    btnActiveBg: '#2d5f5c',
    btnActiveText: '#fff',
    timer: '#2d5f5c',
  },
  {
    name: 'Warm clay',
    panelBg: '#faf4f0',
    panelBorder: '#a86b52',
    accent: '#7a4a38',
    btnBg: '#f5ebe6',
    btnBorder: '#a86b52',
    btnText: '#3a2520',
    btnActiveBg: '#7a4a38',
    btnActiveText: '#fff',
    timer: '#7a4a38',
  },
  {
    name: 'Slate blue',
    panelBg: '#f4f6fa',
    panelBorder: '#5a6d8a',
    accent: '#3a4d66',
    btnBg: '#e9eef5',
    btnBorder: '#5a6d8a',
    btnText: '#1f2a38',
    btnActiveBg: '#3a4d66',
    btnActiveText: '#fff',
    timer: '#3a4d66',
  },
  {
    name: 'Plum dusk',
    panelBg: '#f9f4f8',
    panelBorder: '#8a5a7d',
    accent: '#5e3d54',
    btnBg: '#f2e8ef',
    btnBorder: '#8a5a7d',
    btnText: '#321f2c',
    btnActiveBg: '#5e3d54',
    btnActiveText: '#fff',
    timer: '#5e3d54',
  },
]

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickPaletteForRound(participantId, roundId) {
  if (!participantId || !roundId) return LIVE_QUIZ_PALETTES[0]
  const idx = hashString(`${participantId}:${roundId}`) % LIVE_QUIZ_PALETTES.length
  return LIVE_QUIZ_PALETTES[idx]
}

export function paletteToCssVars(palette) {
  return {
    '--live-panel-bg': palette.panelBg,
    '--live-panel-border': palette.panelBorder,
    '--live-accent': palette.accent,
    '--live-btn-bg': palette.btnBg,
    '--live-btn-border': palette.btnBorder,
    '--live-btn-text': palette.btnText,
    '--live-btn-active-bg': palette.btnActiveBg,
    '--live-btn-active-text': palette.btnActiveText,
    '--live-timer-color': palette.timer,
  }
}