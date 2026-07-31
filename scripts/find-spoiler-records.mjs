/**
 * Find records matching today's daily answers.
 * Usage: node scripts/find-spoiler-records.mjs [extraWord...]
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

function formatDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** mirror src/lib/game.ts dailyIndex */
function dailyIndex(length, date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const seed = y * 10000 + m * 100 + d
  let x = seed ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x = (x ^ (x >>> 16)) >>> 0
  return x % length
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

const answers5 = JSON.parse(
  readFileSync(new URL('../public/dict/answers-5.json', import.meta.url), 'utf8'),
)
const answers7 = JSON.parse(
  readFileSync(new URL('../public/dict/answers-7.json', import.meta.url), 'utf8'),
)

const easy = answers5[dailyIndex(answers5.length)]
const hard = answers7[dailyIndex(answers7.length)]
const extra = process.argv.slice(2)
const targets = new Set([easy.word, hard.word, ...extra])

console.log('today', formatDateKey())
console.log('daily easy', easy.word)
console.log('daily hard', hard.word)

const snap = await getDocs(query(collection(db, 'records'), limit(1000)))
const hits = []
for (const d of snap.docs) {
  const data = d.data()
  const word = String(data.word ?? '')
  if (!targets.has(word) && word !== '시디롬') continue
  hits.push({
    id: d.id,
    name: data.name,
    word,
    playMode: data.playMode ?? '(없음)',
    difficulty: data.difficulty,
    attempts: data.attempts,
    seconds: data.seconds,
    won: data.won,
    dateKey: data.dateKey,
    savedAt: data.savedAt,
  })
}

hits.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
console.log('hits', hits.length)
console.log(JSON.stringify(hits, null, 2))
