import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /** 로그인 uid 또는 guest — 로컬 장착/체험 격리 */
  accountKey?: string
  ownedThemeIds?: readonly string[]
  equippedFromCloud?: string | null
}

function resolveForAccount(
  accountKey: string,
  ownedThemeIds: readonly string[],
  equippedFromCloud: string | null | undefined,
): { equippedId: BoardThemeId; trial: ThemeTrial | null } {
  const trial = loadThemeTrial(accountKey)
  const cloud =
    equippedFromCloud && isBoardThemeId(equippedFromCloud)
      ? equippedFromCloud
      : null

  if (cloud && canUseTheme(cloud, ownedThemeIds, trial)) {
    saveEquippedTheme(cloud, accountKey)
    return { equippedId: cloud, trial }
  }

  const local = loadEquippedTheme(accountKey)
  if (canUseTheme(local, ownedThemeIds, trial)) {
    return { equippedId: local, trial }
  }

  if (trial && trial.gamesLeft > 0) {
    saveEquippedTheme(trial.themeId, accountKey)
    return { equippedId: trial.themeId, trial }
  }

  saveEquippedTheme(DEFAULT_THEME, accountKey)
  return { equippedId: DEFAULT_THEME, trial: null }
}

export function useBoardTheme(options: Options = {}) {
  const accountKey = options.accountKey || 'guest'
  const ownedThemeIds = options.ownedThemeIds ?? [DEFAULT_THEME]
  const initial = resolveForAccount(
    accountKey,
    ownedThemeIds,
    options.equippedFromCloud,
  )
  const [equippedId, setEquippedId] = useState<BoardThemeId>(
    () => initial.equippedId,
  )
  const [previewId, setPreviewId] = useState<BoardThemeId | null>(null)
  const [trial, setTrial] = useState<ThemeTrial | null>(() => initial.trial)
  const accountRef = useRef(accountKey)

  // 계정 전환 시 해당 계정 로컬+클라우드 상태로 리셋
  useEffect(() => {
    if (accountRef.current === accountKey) return
    accountRef.current = accountKey
    setPreviewId(null)
    const next = resolveForAccount(
      accountKey,
      ownedThemeIds,
      options.equippedFromCloud,
    )
    setTrial(next.trial)
    setEquippedId(next.equippedId)
  }, [accountKey, ownedThemeIds, options.equippedFromCloud])

  // 같은 계정에서 클라우드 장착/보유 목록이 갱신될 때 (구매·장착 후)
  useEffect(() => {
    if (accountRef.current !== accountKey) return
    const cloud = options.equippedFromCloud
    if (!cloud || !isBoardThemeId(cloud)) return
    // 체험 중엔 클라우드(기본 등)로 덮지 않음. 구매 시 endTrial 후 이 효과가 적용됨
    if (trial && trial.gamesLeft > 0) return
    if (!canUseTheme(cloud, ownedThemeIds, trial)) return
    setEquippedId(cloud)
    saveEquippedTheme(cloud, accountKey)
  }, [accountKey, options.equippedFromCloud, ownedThemeIds, trial])

  // 체험 종료 후 장착이 막히면 기본으로
  useEffect(() => {
    if (!canUseTheme(equippedId, ownedThemeIds, trial)) {
      setEquippedId(DEFAULT_THEME)
      saveEquippedTheme(DEFAULT_THEME, accountKey)
    }
  }, [accountKey, equippedId, ownedThemeIds, trial])

  const themeId = useMemo(
    () => resolveActiveTheme(equippedId, ownedThemeIds, trial, previewId),
    [equippedId, ownedThemeIds, trial, previewId],
  )

  const equipLocal = useCallback(
    (id: BoardThemeId) => {
      if (!canUseTheme(id, ownedThemeIds, trial)) return false
      setEquippedId(id)
      saveEquippedTheme(id, accountKey)
      setPreviewId(null)
      return true
    },
    [accountKey, ownedThemeIds, trial],
  )

  const preview = useCallback((id: BoardThemeId | null) => {
    setPreviewId(id)
  }, [])

  const startTrial = useCallback(
    (id: BoardThemeId) => {
      if (id === DEFAULT_THEME) return null
      const next = startThemeTrial(id, accountKey)
      setTrial(next)
      setEquippedId(id)
      saveEquippedTheme(id, accountKey)
      setPreviewId(null)
      return next
    },
    [accountKey],
  )

  const consumeTrialGame = useCallback(() => {
    const current = loadThemeTrial(accountKey)
    if (!current) return
    const next = consumeThemeTrialGame(accountKey)
    setTrial(next)
    if (!next) {
      clearThemeTrial(accountKey)
      setEquippedId((prev) => {
        if (prev === current.themeId && !ownedThemeIds.includes(prev)) {
          saveEquippedTheme(DEFAULT_THEME, accountKey)
          return DEFAULT_THEME
        }
        return prev
      })
    }
  }, [accountKey, ownedThemeIds])

  const endTrial = useCallback(() => {
    clearThemeTrial(accountKey)
    setTrial(null)
  }, [accountKey])

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
    endTrial,
    setEquippedId: (id: BoardThemeId) => {
      setEquippedId(id)
      saveEquippedTheme(id, accountKey)
    },
  }
}
