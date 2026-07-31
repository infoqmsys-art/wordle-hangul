/**
 * Delete daily / spoiler rank records from Firestore.
 * Requires firestore.rules to allow delete, and usually firebase login + deploy.
 *
 * Usage: node scripts/purge-daily-rank-records.mjs
 */
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
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

function parseDateKey(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

const MANUAL_IDS = [
  'eg6cmpqyAhySRjO960OG',
  'osPh5YzPHAJT8bSKjGrI',
  'OepNux2iEDI0Pi0J5Ln9',
  'VOY5727cVWefvjtKKT3u',
  'krwchA99XQlaiaUn09nZ',
]

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

function dailyWord(difficulty, date) {
  const pool = difficulty === 'hard' ? answers7 : answers5
  return pool[dailyIndex(pool.length, date)]?.word
}

const today = formatDateKey()
const todayWords = new Set([
  dailyWord('easy', new Date()),
  dailyWord('hard', new Date()),
])

const snap = await getDocs(query(collection(db, 'records'), limit(1000)))
const toDelete = []
for (const d of snap.docs) {
  const data = d.data()
  const word = String(data.word ?? '')
  const dateKey = String(data.dateKey ?? '')
  const difficulty =
    data.difficulty === 'hard' || Number(data.wordLength ?? 5) === 7
      ? 'hard'
      : 'easy'
  const date = parseDateKey(dateKey)
  const wasDaily =
    data.playMode === 'daily' ||
    MANUAL_IDS.includes(d.id) ||
    todayWords.has(word) ||
    (date != null && dailyWord(difficulty, date) === word)

  if (!wasDaily) continue
  toDelete.push({
    id: d.id,
    name: data.name,
    word,
    attempts: data.attempts,
    seconds: data.seconds,
    playMode: data.playMode ?? '(없음)',
    dateKey,
  })
}

console.log('today', today, [...todayWords])
console.log('to delete', toDelete.length)
console.log(JSON.stringify(toDelete, null, 2))

let ok = 0
let fail = 0
for (const row of toDelete) {
  try {
    await deleteDoc(doc(db, 'records', row.id))
    ok += 1
    console.log('deleted', row.id, row.word, row.name)
  } catch (err) {
    fail += 1
    console.error('fail', row.id, err?.code || err?.message || err)
  }
}
console.log({ ok, fail })
if (fail > 0) {
  console.error(
    '삭제가 막혀 있으면 firestore.rules 에서 records delete 를 잠시 허용한 뒤 배포하세요.',
  )
  process.exitCode = 1
}
