import { useCallback, useState } from 'react'
import {
  loadBoardTheme,
  saveBoardTheme,
  type BoardThemeId,
} from '../lib/themes'

export function useBoardTheme() {
  const [themeId, setThemeId] = useState<BoardThemeId>(() => loadBoardTheme())

  const setTheme = useCallback((id: BoardThemeId) => {
    saveBoardTheme(id)
    setThemeId(id)
  }, [])

  return { themeId, setTheme }
}
