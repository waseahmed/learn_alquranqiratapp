/**
 * Qari library for Al Quran Qirat Academy.
 * `availableForSurah` limits a Qari to specific Surahs when set.
 */
export const qaris = [
  { key: 'husary', name: 'Mahmoud Khalil Al-Husary', style: 'Clear & measured' },
  { key: 'minshawi', name: 'Muhammad Siddiq Al-Minshawi', style: 'Melodic & controlled' },
  { key: 'mishary', name: 'Mishary Rashid Alafasy', style: 'Smooth & accessible' },
  { key: 'maher', name: 'Maher Al-Muaiqly', style: 'Calm & balanced' },
  { key: 'shuraim', name: 'Saud Al-Shuraim', style: 'Strong & rhythmic' },
  { key: 'dosari', name: 'Yasser Al-Dosari', style: 'Expressive & dynamic' },
  { key: 'sudais', name: 'Abdul Rahman Al-Sudais', style: 'Classic & rhythmic' },
  { key: 'abdulbasit', name: 'Abdul Basit Abdus-Samad – Murattal', style: 'Powerful & melodic' },
  { key: 'ajmi', name: 'Ahmed Al-Ajmi', style: 'Warm & expressive' },
  { key: 'ghamdi', name: 'Saad Al-Ghamdi', style: 'Steady & easy to follow' },
  { key: 'ayyoub', name: 'Muhammad Ayyoub', style: 'Full Quran' },
  { key: 'rifai', name: 'Hani Ar-Rifai', style: 'Full Quran' },
  { key: 'budair', name: 'Salah Al-Budair', style: 'Full Quran' },
  {
    key: 'qatami',
    name: 'Nasser Al-Qatami',
    style: 'Surah Fatir only',
    availableForSurah: [35],
  },
]

export const CLEAR_EASY_PRESET = ['husary', 'maher', 'ghamdi']
export const MELODIC_PRESET = ['minshawi', 'mishary', 'abdulbasit']
export const DEFAULT_SELECTED_QARIS = ['husary', 'mishary', 'shuraim']

export function getQarisForSurah(surahNumber) {
  return qaris.filter((q) => {
    if (!q.availableForSurah) return true
    return q.availableForSurah.includes(Number(surahNumber))
  })
}
