import { useCallback, useEffect, useState } from 'react'
import {
  authErrorMessage,
  isAuthEnabled,
  signInWithNickname,
  signOutUser,
  signUpWithNickname,
  subscribeAuth,
  updateNickname,
  type UserProfile,
} from '../lib/auth'

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(!isAuthEnabled())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    isLoggedIn: Boolean(user),
    enabled: isAuthEnabled(),
  }
}
