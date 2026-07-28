export type WordEntry = {
  word: string
  jamo: string[]
}

export type Dictionary = {
  /** 자모키 → 표제어 (추측 허용) */
  guesses: Record<string, string>
  /** 오늘의 단어 후보 */
  answers: WordEntry[]
  source: string
}

let cached: Dictionary | null = null
let loading: Promise<Dictionary> | null = null

function jamoKey(jamo: string[]): string {
  return jamo.join('')
}

export async function loadDictionary(): Promise<Dictionary> {
  if (cached) return cached
  if (loading) return loading

  loading = (async () => {
    const base = import.meta.env.BASE_URL
    const [guessRes, answerRes] = await Promise.all([
      fetch(`${base}dict/guesses.json`),
      fetch(`${base}dict/answers.json`),
    ])
    if (!guessRes.ok || !answerRes.ok) {
      throw new Error('사전 데이터를 불러오지 못했어요')
    }
    const guesses = (await guessRes.json()) as Record<string, string>
    const answers = (await answerRes.json()) as WordEntry[]
    cached = {
      guesses,
      answers,
      source: '표준국어대사전 명사(추측) + 일상 친숙어(정답)',
    }
    return cached
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

export function isValidGuess(dict: Dictionary, jamo: string[]): boolean {
  if (jamo.length !== 5) return false
  return Boolean(dict.guesses[jamoKey(jamo)])
}

export function findWordByJamo(
  dict: Dictionary,
  jamo: string[],
): string | undefined {
  return dict.guesses[jamoKey(jamo)]
}

export function getAnswerByIndex(dict: Dictionary, index: number): WordEntry {
  return dict.answers[index % dict.answers.length]
}

/** 최근 나온 단어를 피해서 랜덤 정답 선택 */
export function pickRandomAnswer(
  dict: Dictionary,
  avoidWords: string[] = [],
): WordEntry {
  const avoid = new Set(avoidWords)
  const pool = dict.answers.filter((a) => !avoid.has(a.word))
  const source = pool.length > 0 ? pool : dict.answers
  const idx = Math.floor(Math.random() * source.length)
  return source[idx]
}
