const DB_NAME = 'aqqa_shadow_practice'
const DB_VERSION = 1
const STORE = 'blobs'
const MANIFEST_PREFIX = 'aqqa_shadow_manifest:'
const MAX_PER_AYAH = 3

function manifestKey(scope, surah, ayah) {
  return `${MANIFEST_PREFIX}${scope}:${surah}:${ayah}`
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

async function putBlob(id, blob) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(blob, id)
  })
}

async function deleteBlob(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).delete(id)
  })
}

export async function getShadowRecordingBlob(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export function listShadowRecordings(scope, surah, ayah) {
  try {
    const raw = localStorage.getItem(manifestKey(scope, surah, ayah))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeManifest(scope, surah, ayah, entries) {
  localStorage.setItem(manifestKey(scope, surah, ayah), JSON.stringify(entries))
}

/**
 * Save recording; keeps latest MAX_PER_AYAH (drops oldest).
 * @returns {Promise<object[]>} updated list
 */
export async function pushShadowRecording(scope, surah, ayah, blob, meta = {}) {
  const entries = listShadowRecordings(scope, surah, ayah)
  const id = crypto.randomUUID()
  const entry = {
    id,
    savedAt: new Date().toISOString(),
    coachKey: meta.coachKey || null,
    label: meta.label || null,
  }
  await putBlob(id, blob)
  let next = [...entries, entry].sort((a, b) => a.savedAt.localeCompare(b.savedAt))
  while (next.length > MAX_PER_AYAH) {
    const removed = next.shift()
    await deleteBlob(removed.id)
  }
  writeManifest(scope, surah, ayah, next)
  return next
}

export async function removeShadowRecording(scope, surah, ayah, id) {
  const entries = listShadowRecordings(scope, surah, ayah)
  const next = entries.filter((e) => e.id !== id)
  await deleteBlob(id)
  writeManifest(scope, surah, ayah, next)
  return next
}

export function formatSavedAt(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}