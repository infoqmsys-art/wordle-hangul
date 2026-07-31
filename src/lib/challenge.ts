import type { Difficulty } from '../data/words'
import { DIFFICULTY_META, type Dictionary, type WordEntry } from '../data/words'

export type ChallengePayload = {
  difficulty: Difficulty
  word: string
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(code: string): string {
  const padded = code.replace(/-/g, '+').replace(/_/g, '/')
  const pad =
    padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeChallenge(payload: ChallengePayload): string {
  return toBase64Url(`${payload.difficulty}:${payload.word}`)
}

export function decodeChallenge(code: string): ChallengePayload | null {
  try {
    const raw = fromBase64Url(code.trim())
    const i = raw.indexOf(':')
    if (i <= 0) return null
    const difficulty = raw.slice(0, i)
    const word = raw.slice(i + 1).trim()
    if (difficulty !== 'easy' && difficulty !== 'hard') return null
    if (!word) return null
    return { difficulty, word }
  } catch {
    return null
  }
}

export function buildChallengeUrl(payload: ChallengePayload): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('c', encodeChallenge(payload))
  return url.toString()
}

export function readChallengeFromUrl(): ChallengePayload | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('c')
  if (!code) return null
  return decodeChallenge(code)
}

export function clearChallengeFromUrl(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('c')) return
  url.searchParams.delete('c')
  const search = url.searchParams.toString()
  window.history.replaceState(
    {},
    '',
    `${url.pathname}${search ? `?${search}` : ''}${url.hash}`,
  )
}

export function findChallengeEntry(
  dict: Dictionary,
  payload: ChallengePayload,
): WordEntry | null {
  const wantLen = DIFFICULTY_META[payload.difficulty].wordLength
  const pool =
    payload.difficulty === 'hard' ? dict.answers7 : dict.answers5
  const fromPool = pool.find((a) => a.word === payload.word)
  if (fromPool && fromPool.jamo.length === wantLen) return fromPool

  for (const [key, word] of Object.entries(dict.guesses)) {
    if (word !== payload.word) continue
    const jamo = Array.from(key)
    if (jamo.length === wantLen) return { word, jamo }
  }
  return null
}

export async function shareChallenge(input: {
  difficulty: Difficulty
  word: string
  fromName?: string
}): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = buildChallengeUrl({
    difficulty: input.difficulty,
    word: input.word,
  })
  const who = input.fromName?.trim()
  const text = [
    '푸들푸들',
    who
      ? `${who}님이 보낸 도전 · ${DIFFICULTY_META[input.difficulty].label}`
      : `이 문제 한번 풀어봐! · ${DIFFICULTY_META[input.difficulty].label}`,
    '(정답은 링크에만 들어 있어요)',
    '',
    url,
  ].join('\n')

  try {
    if (navigator.share) {
      await navigator.share({ title: '푸들푸들 단어 도전', text, url })
      return 'shared'
    }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'cancelled'
  }
}
