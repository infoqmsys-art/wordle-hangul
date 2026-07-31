/**
 * List records that look like daily (for cleanup).
 * Usage: node scripts/list-daily-records.mjs
 */
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
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
const daily = []
const noMode = []
for (const d of snap.docs) {
  const data = d.data()
  const row = {
    id: d.id,
    name: data.name,
    word: data.word,
    playMode: data.playMode ?? '(없음)',
    difficulty: data.difficulty,
    attempts: data.attempts,
    seconds: data.seconds,
    won: data.won,
    dateKey: data.dateKey,
    savedAt: data.savedAt,
  }
  if (data.playMode === 'daily') daily.push(row)
  else if (!data.playMode) noMode.push(row)
}

console.log('total', snap.size)
console.log('playMode=daily', daily.length)
console.log(JSON.stringify(daily.slice(0, 50), null, 2))
console.log('playMode missing', noMode.length)
console.log(
  'missing sample words',
  [...new Set(noMode.map((r) => r.word))].slice(0, 40),
)
