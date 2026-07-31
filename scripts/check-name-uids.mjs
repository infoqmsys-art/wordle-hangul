/**
 * Check whether nicknames share the same uid in records / users / nicknames.
 * Usage: node scripts/check-name-uids.mjs 유빙 윱 박유빈
 */
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from 'firebase/firestore'

function loadEnv() {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    out[m[1].trim()] = m[2].trim()
  }
  return out
}

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('usage: node scripts/check-name-uids.mjs name1 name2 ...')
  process.exit(1)
}

const env = loadEnv()
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

const snap = await getDocs(query(collection(db, 'records'), limit(1000)))
const byName = new Map()
for (const d of snap.docs) {
  const data = d.data()
  const name = String(data.name ?? '').trim()
  if (!names.includes(name)) continue
  const list = byName.get(name) ?? []
  list.push({
    id: d.id,
    uid: data.uid ? String(data.uid) : '(없음)',
    word: data.word,
    won: data.won,
    attempts: data.attempts,
    seconds: data.seconds,
    dateKey: data.dateKey,
    playMode: data.playMode ?? '(없음)',
    savedAt: data.savedAt,
  })
  byName.set(name, list)
}

console.log('=== records by name ===')
for (const name of names) {
  const list = byName.get(name) ?? []
  const uids = [...new Set(list.map((r) => r.uid))]
  console.log(`\n[${name}] records=${list.length} uids=${JSON.stringify(uids)}`)
  console.log(JSON.stringify(list.slice(0, 20), null, 2))
}

console.log('\n=== nicknames collection ===')
for (const name of names) {
  try {
    const nSnap = await getDocs(
      query(collection(db, 'nicknames'), where('uid', '!=', ''), limit(1)),
    )
    // try direct doc id variants
    void nSnap
  } catch {
    /* ignore */
  }
}

// nickname docs often keyed by normalized nick
for (const name of names) {
  const variants = [
    name,
    name.toLowerCase(),
    encodeURIComponent(name),
  ]
  // scan nicknames collection for matching nickname field
}

const nickSnap = await getDocs(query(collection(db, 'nicknames'), limit(500)))
const nickHits = []
for (const d of nickSnap.docs) {
  const data = d.data()
  const nick = String(data.nickname ?? data.name ?? d.id)
  if (names.some((n) => nick.includes(n) || d.id.includes(n))) {
    nickHits.push({
      id: d.id,
      uid: data.uid ?? '(없음)',
      nickname: data.nickname ?? data.name ?? null,
      data,
    })
  }
}
console.log(JSON.stringify(nickHits, null, 2))

const weekSnap = await getDocs(query(collection(db, 'weeklyRank'), limit(20)))
console.log('\n=== weeklyRank week docs ===', weekSnap.docs.map((d) => d.id))

// Also aggregate uid overlap summary
console.log('\n=== uid overlap summary ===')
const uidToNames = new Map()
for (const [name, list] of byName) {
  for (const r of list) {
    if (r.uid === '(없음)') continue
    const set = uidToNames.get(r.uid) ?? new Set()
    set.add(name)
    uidToNames.set(r.uid, set)
  }
}
for (const [uid, set] of uidToNames) {
  console.log(uid, [...set])
}
const allUids = [...uidToNames.keys()]
console.log('distinct uids with these names:', allUids.length)
