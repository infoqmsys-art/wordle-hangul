import { useCallback, useEffect, useState } from 'react'
import {
  authErrorMessage,
  completeNicknameSetup,
  consumeGoogleRedirect,
  isAuthEnabled,
  signInWithGoogle,
  signOutUser,
  subscribeAuth,
  updateNickname,
  type NicknameSetup,
  type UserProfile,
} from '../lib/auth'
import { inAppLoginHint, isInAppBrowser } from '../lib/browser'

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [nicknameSetup, setNicknameSetup] = useState<NicknameSetup | null>(
    null,
  )
  const [ready, setReady] = useState(!isAuthEnabled())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inAppHint] = useState(() =>
    typeof navigator !== 'undefined' && isInAppBrowser()
      ? inAppLoginHint()
      : '',
  )

  useEffect(() => {
    if (!isAuthEnabled()) {
      setReady(true)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const redirected = await consumeGoogleRedirect()
        if (cancelled || !redirected) return
        if (redirected.status === 'ready') {
          setUser(redirected.profile)
          setNicknameSetup(null)
        } else if (redirected.status === 'needs-nickname') {
          setUser(null)
          setNicknameSetup(redirected.setup)
        }
      } catch (err) {
        if (!cancelled) {
          const message = authErrorMessage(err)
          if (message) setError(message)
        }
      }
    })()

    const unsub = subscribeAuth((state) => {
      if (state.status === 'signed-out') {
        setUser(null)
        setNicknameSetup(null)
      } else if (state.status === 'ready') {
        setUser(state.profile)
        setNicknameSetup(null)
      } else {
        setUser(null)
        setNicknameSetup(state.setup)
      }
      setReady(true)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const signIn = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await signInWithGoogle()
      if (result.status === 'redirecting') {
        // 페이지가 Google로 이동 중
        return null
      }
      if (result.status === 'ready') {
        setUser(result.profile)
        setNicknameSetup(null)
        return result.profile
      }
      setUser(null)
      setNicknameSetup(result.setup)
      return null
    } catch (err) {
      console.error('[auth] Google sign-in failed', err)
      const message = authErrorMessage(err)
      if (message) setError(message)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const submitNickname = useCallback(
    async (nickname: string) => {
      if (!nicknameSetup) return null
      setBusy(true)
      setError(null)
      try {
        const profile = await completeNicknameSetup(
          nicknameSetup.user,
          nickname,
        )
        setUser(profile)
        setNicknameSetup(null)
        return profile
      } catch (err) {
        console.error('[auth] nickname setup failed', err)
        const message = authErrorMessage(err) ?? '닉네임 저장에 실패했어요'
        setError(message)
        return null
      } finally {
        setBusy(false)
      }
    },
    [nicknameSetup],
  )

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

  const cancelNicknameSetup = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await signOutUser()
      setUser(null)
      setNicknameSetup(null)
    } catch {
      setError('취소에 실패했어요')
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await signOutUser()
      setUser(null)
      setNicknameSetup(null)
    } catch {
      setError('로그아웃에 실패했어요')
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    user,
    nicknameSetup,
    ready,
    busy,
    error,
    inAppHint,
    clearError: () => setError(null),
    signIn,
    submitNickname,
    rename,
    cancelNicknameSetup,
    signOut,
    isLoggedIn: Boolean(user),
    enabled: isAuthEnabled(),
  }
}
