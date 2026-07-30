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
  return false
}

export function cleanCurrentUrl(): string {
  const url = new URL(window.location.href)
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

function tryAssign(href: string): void {
  try {
    window.location.assign(href)
  } catch {
    try {
      window.location.href = href
    } catch {
      /* ignore */
    }
  }
}

/**
 * 카톡/인앱 → 외부 브라우저 열기 시도.
 * 스킴이 실패해도 조용히 넘어가므로, UI에서 안내·복사를 반드시 같이 보여야 함.
 */
export function openInExternalBrowser(target = cleanCurrentUrl()): boolean {
  const encoded = encodeURIComponent(target)

  if (isKakaoTalkBrowser()) {
    if (isAndroid()) {
      const bare = target.replace(/^https?:\/\//i, '')
      // Chrome → 기본 브라우저 순으로 시도
      tryAssign(
        `intent://${bare}#Intent;scheme=https;action=android.intent.action.VIEW;end`,
      )
      return true
    }
    // iOS 카톡: openExternal 스킴 (버전마다 동작 다름)
    tryAssign(`kakaotalk://web/openExternal?url=${encoded}`)
    return true
  }

  if (isAndroid() && isInAppBrowser()) {
    const bare = target.replace(/^https?:\/\//i, '')
    tryAssign(
      `intent://${bare}#Intent;scheme=https;action=android.intent.action.VIEW;end`,
    )
    return true
  }

  // 최후: 새 탭 (대부분 인앱에선 무시됨)
  try {
    const w = window.open(target, '_blank', 'noopener,noreferrer')
    return Boolean(w)
  } catch {
    return false
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function inAppLoginHint(): string {
  if (isKakaoTalkBrowser()) {
    if (isIOS()) {
      return '카카오톡 안에서는 Google 로그인이 막혀 있어요. 우측 하단 ··· → Safari로 열기 후 다시 로그인해 주세요'
    }
    return '카카오톡 안에서는 Google 로그인이 막혀 있어요. Chrome/기본 브라우저로 연 뒤 다시 로그인해 주세요'
  }
  if (isInAppBrowser()) {
    return '앱 안 브라우저에서는 Google 로그인이 막혀 있어요. Chrome/Safari로 열어 주세요'
  }
  return ''
}
