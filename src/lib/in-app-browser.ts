/** Google 로그인이 차단되는 앱 내부 브라우저인지 확인한다. */
export function isBlockedInAppBrowser(userAgent: string): boolean {
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|; wv\)/i.test(userAgent);
}
