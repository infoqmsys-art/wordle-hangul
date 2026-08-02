/**
 * 정답 풀 단어의 표준국어대사전 뜻을 받아 캐시에 저장한다.
 * .env 의 STDICT_API_KEY 필요.
 *
 * Usage: npm run dict:defs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cachePath = join(__dirname, 'data/definitions-cache.json')
const dictDir = join(root, 'public/dict')

function loadEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return {}
  const out = {}
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    out[m[1].trim()] = m[2].trim()
  }
  return out
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseDefinition(data) {
  const raw = data?.channel?.item
  if (!raw) return null
  const item = Array.isArray(raw) ? raw[0] : raw
  const def = item?.sense?.definition
  return typeof def === 'string' && def.trim() ? def.trim() : null
}

const env = loadEnv()
const apiKey = env.STDICT_API_KEY || process.env.STDICT_API_KEY || ''
if (!apiKey) {
  console.error('STDICT_API_KEY 가 .env 에 없어요.')
  process.exit(1)
}

// 최신 정답 풀 생성
const built = spawnSync('node', [join(__dirname, 'build-dict.mjs')], {
  cwd: root,
  stdio: 'inherit',
})
if (built.status !== 0) process.exit(built.status ?? 1)

const a5 = JSON.parse(readFileSync(join(dictDir, 'answers-5.json'), 'utf8'))
const a7 = JSON.parse(readFileSync(join(dictDir, 'answers-7.json'), 'utf8'))
const words = [...new Set([...a5, ...a7].map((e) => e.word))]

let cache = {}
if (existsSync(cachePath)) {
  try {
    cache = JSON.parse(readFileSync(cachePath, 'utf8'))
  } catch {
    cache = {}
  }
}

mkdirSync(dirname(cachePath), { recursive: true })

const pending = words.filter((w) => !cache[w])
console.log(`words=${words.length} cached=${words.length - pending.length} fetch=${pending.length}`)

let ok = 0
let fail = 0
for (let i = 0; i < pending.length; i += 1) {
  const word = pending[i]
  const url = new URL('https://stdict.korean.go.kr/api/search.do')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('q', word)
  url.searchParams.set('req_type', 'json')

  try {
    const res = await fetch(url)
    if (!res.ok) {
      fail += 1
      console.warn(`[${i + 1}/${pending.length}] fail ${word} HTTP ${res.status}`)
    } else {
      const data = await res.json()
      const def = parseDefinition(data)
      if (def) {
        cache[word] = def
        ok += 1
      } else {
        fail += 1
        console.warn(`[${i + 1}/${pending.length}] no-def ${word}`)
      }
    }
  } catch (err) {
    fail += 1
    console.warn(`[${i + 1}/${pending.length}] error ${word}`, err.message)
  }

  if ((i + 1) % 20 === 0 || i + 1 === pending.length) {
    writeFileSync(cachePath, JSON.stringify(cache, null, 0), 'utf8')
    console.log(`saved cache ${Object.keys(cache).length} (+${ok} / fail ${fail})`)
  }

  await sleep(120)
}

writeFileSync(cachePath, JSON.stringify(cache, null, 0), 'utf8')
spawnSync('node', [join(__dirname, 'build-dict.mjs')], {
  cwd: root,
  stdio: 'inherit',
})
console.log(`DONE ok=${ok} fail=${fail} cache=${Object.keys(cache).length}`)
