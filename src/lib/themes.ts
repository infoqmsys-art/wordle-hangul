export type BoardThemeId =
  | 'default'
  | 'cat'
  | 'sakura'
  | 'lemon'
  | 'mint'
  | 'sky'
  | 'candy'

export type BoardTheme = {
  id: BoardThemeId
  name: string
  description: string
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'default',
    name: '기본',
    description: '푸들푸들 기본 톤',
  },
  {
    id: 'cat',
    name: '고양이',
    description: '크림·살구빛 귀여운 톤',
  },
  {
    id: 'sakura',
    name: '벚꽃',
    description: '분홍·라벤더 파스텔',
  },
  {
    id: 'lemon',
    name: '레몬',
    description: '상큼한 노랑·시트러스',
  },
  {
    id: 'mint',
    name: '민트',
    description: '시원한 민트·연두',
  },
  {
    id: 'sky',
    name: '하늘',
    description: '맑은 하늘색·구름톤',
  },
  {
    id: 'candy',
    name: '캔디',
    description: '통통 튀는 사탕 색',
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
