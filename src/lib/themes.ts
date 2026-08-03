export type BoardThemeId =
  | 'default'
  | 'chalkboard'
  | 'cat'
  | 'sakura'
  | 'night'

export type BoardTheme = {
  id: BoardThemeId
  name: string
  description: string
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'default',
    name: '기본',
    description: '지금 푸들푸들 기본 톤',
  },
  {
    id: 'chalkboard',
    name: '칠판',
    description: '분필 느낌의 어두운 보드',
  },
  {
    id: 'cat',
    name: '고양이',
    description: '크림·살구빛 귀여운 톤',
  },
  {
    id: 'sakura',
    name: '애니감',
    description: '파스텔 분홍·라벤더 (캐릭터 아님)',
  },
  {
    id: 'night',
    name: '야간',
    description: '어두운 배경 + 선명한 타일',
  },
]

export const DEFAULT_THEME: BoardThemeId = 'default'
const STORAGE_KEY = 'wordle-hangul-board-theme'

export function isBoardThemeId(value: string): value is BoardThemeId {
  return BOARD_THEMES.some((t) => t.id === value)
}

export function loadBoardTheme(): BoardThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? ''
    if (isBoardThemeId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function saveBoardTheme(id: BoardThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
