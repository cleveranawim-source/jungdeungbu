// 카카오톡·네이버·인스타그램·페이스북·라인 앱 안 브라우저(웹뷰). Google 은 웹뷰에서의 로그인을 막으므로
// (disallowed_useragent) 교사 로그인 화면은 이런 곳에서 Google 버튼 대신 바깥 브라우저로 여는 법을 알려 준다.

const IN_APP_RE = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i;

export type InAppKind = 'kakao' | 'other';

/** 앱 안 브라우저면 그 종류, 아니면 null. */
export function inAppBrowser(ua: string): InAppKind | null {
  if (!IN_APP_RE.test(ua)) return null;
  return /KAKAOTALK/i.test(ua) ? 'kakao' : 'other';
}

/** 안드로이드 카카오톡: 카카오톡이 바깥 브라우저(Chrome)로 열어 주는 주소를 쓸 수 있다. */
export function isAndroidKakao(ua: string): boolean {
  return /KAKAOTALK/i.test(ua) && /Android/i.test(ua);
}

/** 카카오톡(안드로이드)에서 이 주소를 바깥 브라우저로 여는 링크. */
export function kakaoOpenExternalHref(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}
