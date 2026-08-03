import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_THEME,
  canUseTheme,
  clearThemeTrial,
  consumeThemeTrialGame,
  isBoardThemeId,
  loadEquippedTheme,
  loadThemeTrial,
  resolveActiveTheme,
  saveEquippedTheme,
  startThemeTrial,
  type BoardThemeId,
  type ThemeTrial,
} from '../lib/themes'

type Options = {
  ownedThemeIds?: string[]
  equippedFromCloud?: string | null
}

export function useBoardTheme(options: Options = {}) {
  const ownedThemeIds = options.ownedThemeIds ?? [DEFAULT_THEME]
  const [equippedId, setEquippedId] = useState<BoardThemeId>(() =>
    loadEquippedTheme(),
  )
  const [previewId, setPreviewId] = useState<BoardThemeId | null>(null)
  const [trial, setTrial] = useState<ThemeTrial | null>(() => loadThemeTrial())

  useEffect(() => {
    const cloud = options.equippedFromCloud
    if (cloud && isBoardThemeId(cloud)) {
      if (canUseTheme(cloud, ownedThemeIds, trial)) {
        setEquippedId(cloud)
        saveEquippedTheme(cloud)
      }
    }
  }, [options.equippedFromCloud, ownedThemeIds, trial])

  // 체험 종료 후 장착이 막히면 기본으로
  useEffect(() => {
    if (!canUseTheme(equippedId, ownedThemeIds, trial)) {
      setEquippedId(DEFAULT_THEME)
      saveEquippedTheme(DEFAULT_THEME)
    }
  }, [equippedId, ownedThemeIds, trial])

  const themeId = useMemo(
    () => resolveActiveTheme(equippedId, ownedThemeIds, trial, previewId),
    [equippedId, ownedThemeIds, trial, previewId],
  )

  const equipLocal = useCallback(
    (id: BoardThemeId) => {
      if (!canUseTheme(id, ownedThemeIds, trial)) return false
      setEquippedId(id)
      saveEquippedTheme(id)
      setPreviewId(null)
      return true
    },
    [ownedThemeIds, trial],
  )

  const preview = useCallback((id: BoardThemeId | null) => {
    setPreviewId(id)
  }, [])

  const startTrial = useCallback((id: BoardThemeId) => {
    if (id === DEFAULT_THEME) return null
    const next = startThemeTrial(id)
    setTrial(next)
    setEquippedId(id)
    saveEquippedTheme(id)
    setPreviewId(null)
    return next
  }, [])

  const consumeTrialGame = useCallback(() => {
    const current = loadThemeTrial()
    if (!current) return
    const next = consumeThemeTrialGame()
    setTrial(next)
    if (!next) {
      clearThemeTrial()
      setEquippedId((prev) => {
        if (prev === current.themeId && !ownedThemeIds.includes(prev)) {
          saveEquippedTheme(DEFAULT_THEME)
          return DEFAULT_THEME
        }
        return prev
      })
    }
  }, [ownedThemeIds])

  return {
    themeId,
    equippedId,
    previewId,
    trial,
    trialGamesLeft: trial?.gamesLeft ?? 0,
    equipLocal,
    preview,
    startTrial,
    consumeTrialGame,
    setEquippedId: (id: BoardThemeId) => {
      setEquippedId(id)
      saveEquippedTheme(id)
    },
  }
}
