/** 카톡/인스타 등 인앱 브라우저 (Google OAuth 차단) */
export function isInAppBrowser(ua = navigator.userAgent): boolean {
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua)
}

export function isKakaoTalkBrowser(ua = navigator.userAgent): boolean {
  return /KAKAOTALK/i.test(ua)
}

export function isAndroid(ua = navigator.userAgent): boolean {
  return /Android/i.test(ua)
}

export function isIOS(ua = navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/i.test(ua)
}

/** 좁은 화면·모바일에서는 팝업보다 리다이렉트가 안정적 */
export function preferAuthRedirect(): boolean {
  if (typeof window === 'undefined') return false
  if (isInAppBrowser()) return true
  if (isAndroid() || isIOS()) return true
  return window.matchMedia('(max-width: 820px)').matches
}

function cleanCurrentUrl(): string {
  const url = new URL(window.location.href)
  // Firebase/Google 리다이렉트 잔여 파라미터 제거
  ;[
    'apiKey',
    'appName',
    'authType',
    'redirectUrl',
    'eventId',
    'code',
    'state',
    'scope',
    'authuser',
    'prompt',
    'hd',
  ].forEach((k) => url.searchParams.delete(k))
  return url.toString()
}

/**
 * 카톡 인앱 → 외부 브라우저로 열기.
 * Android는 Chrome intent, iOS/공통은 kakaotalk openExternal.
 */
export function openInExternalBrowser(target = cleanCurrentUrl()): boolean {
  const encoded = encodeURIComponent(target)

  if (isKakaoTalkBrowser()) {
    if (isAndroid()) {
      const bare = target.replace(/^https?:\/\//i, '')
      window.location.href = `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`
      return true
    }
    window.location.href = `kakaotalk://web/openExternal?url=${encoded}`
    return true
  }

  if (isAndroid() && isInAppBrowser()) {
    const bare = target.replace(/^https?:\/\//i, '')
    window.location.href = `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`
    return true
  }

  return false
}

export function inAppLoginHint(): string {
  if (isKakaoTalkBrowser()) {
    if (isIOS()) {
      return '카카오톡에서는 Google 로그인이 막혀 있어요. 우측 하단 ··· → Safari로 열기를 눌러 주세요'
    }
    return '카카오톡에서는 Google 로그인이 막혀 있어요. 아래 버튼을 누르면 Chrome으로 열어요'
  }
  if (isInAppBrowser()) {
    return '앱 안 브라우저에서는 Google 로그인이 막혀 있어요. 기본 브라우저(Chrome/Safari)로 열어 주세요'
  }
  return ''
}
