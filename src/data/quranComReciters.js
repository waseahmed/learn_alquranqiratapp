/**
 * Quran.com chapter-recitation IDs (murattal-style) for word-level segment timings.
 * @see https://api.quran.com/api/v4/chapter_recitations/{recitation_id}/{chapter}?segments=true
 */
export const QURAN_COM_CHAPTER_RECITATION = {
  mishary: 7,
  husary: 6,
  minshawi: 9,
  sudais: 3,
  shuraim: 10,
  abdulbasit: 2,
  ajmi: 4,
  ghamdi: null,
  maher: null,
  dosari: null,
  ayyoub: null,
  rifai: 5,
  budair: null,
  qatami: null,
}

export function quranComRecitationIdForQari(qariKey) {
  const id = QURAN_COM_CHAPTER_RECITATION[qariKey]
  return id == null ? null : id
}