/** 키보드에 있는 기본 자모 */
export const BASIC_JAMO = [
  'ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ',
  'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ',
  'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ',
] as const

const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

const JUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ',
  'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const

const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ',
  'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ',
  'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

/** 복합 모음/자음을 키보드 기본 자모로 분해 */
const EXPAND: Record<string, string[]> = {
  ㄲ: ['ㄱ', 'ㄱ'],
  ㄸ: ['ㄷ', 'ㄷ'],
  ㅃ: ['ㅂ', 'ㅂ'],
  ㅆ: ['ㅅ', 'ㅅ'],
  ㅉ: ['ㅈ', 'ㅈ'],
  ㅐ: ['ㅏ', 'ㅣ'],
  ㅔ: ['ㅓ', 'ㅣ'],
  ㅒ: ['ㅑ', 'ㅣ'],
  ㅖ: ['ㅕ', 'ㅣ'],
  ㅘ: ['ㅗ', 'ㅏ'],
  ㅙ: ['ㅗ', 'ㅏ', 'ㅣ'],
  ㅚ: ['ㅗ', 'ㅣ'],
  ㅝ: ['ㅜ', 'ㅓ'],
  ㅞ: ['ㅜ', 'ㅓ', 'ㅣ'],
  ㅟ: ['ㅜ', 'ㅣ'],
  ㅢ: ['ㅡ', 'ㅣ'],
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
}

function expandJamo(jamo: string): string[] {
  return EXPAND[jamo] ?? [jamo]
}

/** 한글 음절/문자열을 기본 자모 배열로 분해 (ㅔ → ㅓㅣ) */
export function decomposeToJamo(text: string): string[] {
  const result: string[] = []

  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const s = code - 0xac00
      const cho = CHO[Math.floor(s / 588)]
      const jung = JUNG[Math.floor((s % 588) / 28)]
      const jong = JONG[s % 28]
      result.push(...expandJamo(cho), ...expandJamo(jung))
      if (jong) result.push(...expandJamo(jong))
    } else if (/[ㄱ-ㅎㅏ-ㅣ]/.test(ch)) {
      result.push(...expandJamo(ch))
    }
  }

  return result
}

export function jamoLength(text: string): number {
  return decomposeToJamo(text).length
}

export function isBasicJamo(ch: string): boolean {
  return (BASIC_JAMO as readonly string[]).includes(ch)
}

/** 두벌식(QWERTY) → 기본 자모 */
const QWERTY_TO_JAMO: Record<string, string> = {
  q: 'ㅂ',
  w: 'ㅈ',
  e: 'ㄷ',
  r: 'ㄱ',
  t: 'ㅅ',
  y: 'ㅛ',
  u: 'ㅕ',
  i: 'ㅑ',
  o: 'ㅐ',
  p: 'ㅔ',
  a: 'ㅁ',
  s: 'ㄴ',
  d: 'ㅇ',
  f: 'ㄹ',
  g: 'ㅎ',
  h: 'ㅗ',
  j: 'ㅓ',
  k: 'ㅏ',
  l: 'ㅣ',
  z: 'ㅋ',
  x: 'ㅌ',
  c: 'ㅊ',
  v: 'ㅍ',
  b: 'ㅠ',
  n: 'ㅜ',
  m: 'ㅡ',
}

/** 키보드/IME 입력을 게임용 기본 자모로 변환 (ㅐ→ㅏㅣ) */
export function normalizeInput(key: string): string[] {
  if (isBasicJamo(key)) return [key]
  if (EXPAND[key]) return EXPAND[key]

  const lower = key.toLowerCase()
  const mapped = QWERTY_TO_JAMO[lower]
  if (!mapped) return []
  return EXPAND[mapped] ?? [mapped]
}
