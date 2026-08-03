import { useCallback, useEffect, useState } from 'react'
import {
  applyProgressToProfile,
  authErrorMessage,
  isAuthEnabled,
  signInWithNickname,
  signOutUser,
  signUpWithNickname,
  subscribeAuth,
  updateNickname,
  type UserProfile,
} from '../lib/auth'
import { buyShopItem, consumeHint, syncEconomy } from '../lib/economy'
import { getWeekKey } from '../lib/levels'
import { claimMailItem } from '../lib/mailbox'
import { claimWeekReward, type UserProgress } from '../lib/progress'

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(!isAuthEnabled())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patchProgress = useCallback((progress: UserProgress) => {
    setUser((prev) => (prev ? applyProgressToProfile(prev, progress) : prev))
  }, [])

  useEffect(() => {
    if (!isAuthEnabled()) {
      setReady(true)
      return
    }

    const unsub = subscribeAuth((state) => {
      if (state.status === 'signed-out') {
        setUser(null)
      } else {
        setUser(state.profile)
      }
      setReady(true)
    })

    return unsub
  }, [])

  const signIn = useCallback(async (nickname: string, password: string) => {
    setBusy(true)
    setError(null)
    try {
      const profile = await signInWithNickname(nickname, password)
      setUser(profile)
      return profile
    } catch (err) {
      console.error('[auth] sign-in failed', err)
      const message = authErrorMessage(err)
      if (message) setError(message)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const signUp = useCallback(async (nickname: string, password: string) => {
    setBusy(true)
    setError(null)
    try {
      const profile = await signUpWithNickname(nickname, password)
      setUser(profile)
      return profile
    } catch (err) {
      console.error('[auth] sign-up failed', err)
      const message = authErrorMessage(err)
      if (message) setError(message)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const rename = useCallback(
    async (nickname: string) => {
      if (!user) return false
      setBusy(true)
      setError(null)
      try {
        const next = await updateNickname(user.uid, nickname, user)
        setUser(next)
        return true
      } catch (err) {
        console.error('[auth] rename failed', err)
        const message = authErrorMessage(err) ?? '이름 변경에 실패했어요'
        setError(message)
        return false
      } finally {
        setBusy(false)
      }
    },
    [user],
  )

  const signOut = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await signOutUser()
      setUser(null)
    } catch {
      setError('로그아웃에 실패했어요')
    } finally {
      setBusy(false)
    }
  }, [])

  const claimReward = useCallback(async () => {
    if (!user) return null
    setBusy(true)
    setError(null)
    try {
      const result = await claimWeekReward(user.uid, user.nickname)
      if (!result) {
        setError('받을 보상이 없어요')
        return null
      }
      setUser(applyProgressToProfile(user, result.progress))
      return result
    } catch {
      setError('보상 수령에 실패했어요')
      return null
    } finally {
      setBusy(false)
    }
  }, [user])

  const refreshEconomy = useCallback(async () => {
    if (!user) return
    try {
      const { progress } = await syncEconomy(user.uid, user.nickname)
      setUser((prev) => (prev ? applyProgressToProfile(prev, progress) : prev))
    } catch {
      /* offline */
    }
  }, [user])

  // 월 09:00 주 전환 후 탭이 열려 있어도 동기화·정산
  useEffect(() => {
    if (!user) return

    let last = 0
    const sync = () => {
      const now = Date.now()
      if (now - last < 4000) return
      last = now
      void refreshEconomy()
    }

    if (user.weekKey !== getWeekKey()) sync()

    const onFocus = () => sync()
    const onVis = () => {
      if (document.visibilityState === 'visible') sync()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user, refreshEconomy])

  const buyItem = useCallback(
    async (itemId: string) => {
      if (!user) return false
      setBusy(true)
      setError(null)
      try {
        const progress = await buyShopItem(user.uid, user.nickname, itemId)
        setUser(applyProgressToProfile(user, progress))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : '구매에 실패했어요')
        return false
      } finally {
        setBusy(false)
      }
    },
    [user],
  )

  const useHint = useCallback(async () => {
    if (!user) return null
    setBusy(true)
    setError(null)
    try {
      const progress = await consumeHint(user.uid, user.nickname)
      setUser(applyProgressToProfile(user, progress))
      return progress
    } catch (err) {
      setError(err instanceof Error ? err.message : '힌트 사용에 실패했어요')
      return null
    } finally {
      setBusy(false)
    }
  }, [user])

  const claimMail = useCallback(
    async (mailId: string) => {
      if (!user) return false
      setBusy(true)
      setError(null)
      try {
        const { progress } = await claimMailItem(
          user.uid,
          user.nickname,
          mailId,
        )
        setUser(applyProgressToProfile(user, progress))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : '우편 수령에 실패했어요')
        return false
      } finally {
        setBusy(false)
      }
    },
    [user],
  )

  return {
    user,
    ready,
    busy,
    error,
    clearError: () => setError(null),
    signIn,
    signUp,
    rename,
    signOut,
    claimReward,
    claimMail,
    patchProgress,
    refreshEconomy,
    buyItem,
    useHint,
    isLoggedIn: Boolean(user),
    enabled: isAuthEnabled(),
  }
}
