import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_THEME,
  canUseTheme,
  clearThemeTrial,
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
  const [now, setNow] = useState(() => Date.now())

  // 클라우드 장착값 우선 동기화
  useEffect(() => {
    const cloud = options.equippedFromCloud
    if (cloud && isBoardThemeId(cloud)) {
      setEquippedId(cloud)
      saveEquippedTheme(cloud)
    }
  }, [options.equippedFromCloud])

  // 체험 만료 타이머
  useEffect(() => {
    if (!trial) return
    const left = trial.expiresAt - Date.now()
    if (left <= 0) {
      clearThemeTrial()
      setTrial(null)
      return
    }
    const t = window.setTimeout(() => {
      clearThemeTrial()
      setTrial(null)
      setNow(Date.now())
    }, left + 50)
    const tick = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      window.clearTimeout(t)
      window.clearInterval(tick)
    }
  }, [trial])

  const themeId = useMemo(
    () =>
      resolveActiveTheme(equippedId, ownedThemeIds, trial, previewId, now),
    [equippedId, ownedThemeIds, trial, previewId, now],
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

  const trialRemainingMs = trial ? Math.max(0, trial.expiresAt - now) : 0

  return {
    themeId,
    equippedId,
    previewId,
    trial,
    trialRemainingMs,
    equipLocal,
    preview,
    startTrial,
    setEquippedId: (id: BoardThemeId) => {
      setEquippedId(id)
      saveEquippedTheme(id)
    },
  }
}
