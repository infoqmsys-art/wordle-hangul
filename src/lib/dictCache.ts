import type { Dictionary } from '../data/words'

const DB_NAME = 'wordle-hangul-dict'
const DB_VERSION = 1
const STORE = 'packs'
const PACK_KEY = 'main'

export type DictMeta = {
  version: string
  generatedAt?: string
  counts?: Record<string, number>
  bytes?: Record<string, number>
}

type StoredPack = {
  version: string
  dict: Dictionary
  savedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function idbGet(db: IDBDatabase, key: string): Promise<StoredPack | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as StoredPack | undefined)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'))
  })
}

function idbPut(db: IDBDatabase, key: string, value: StoredPack): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'))
  })
}

export async function readCachedDictionary(
  version: string,
): Promise<Dictionary | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await openDb()
    try {
      const pack = await idbGet(db, PACK_KEY)
      if (!pack || pack.version !== version || !pack.dict?.guesses) return null
      return pack.dict
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}

export async function writeCachedDictionary(
  version: string,
  dict: Dictionary,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await openDb()
    try {
      await idbPut(db, PACK_KEY, {
        version,
        dict,
        savedAt: Date.now(),
      })
    } finally {
      db.close()
    }
  } catch {
    /* quota / private mode */
  }
}
