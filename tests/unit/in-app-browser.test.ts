import { expect, test } from 'vitest';
import { inAppBrowser, isAndroidKakao, kakaoOpenExternalHref } from '../../src/lib/inAppBrowser';

const UA = {
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36;KAKAOTALK 2410960',
  naver: 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.9.4)',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 356.0.0.21.107 (iPhone15,2; iOS 18_1; ko_KR; ko; scale=3.00; 1179x2556)',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/489.0.0.40.109;FBBV/663412335;FBDV/iPhone15,2]',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.18.0',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  whale: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Whale/3.27.0.0 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

test('카카오톡(iOS·안드로이드)은 kakao', () => {
  expect(inAppBrowser(UA.kakaoIos)).toBe('kakao');
  expect(inAppBrowser(UA.kakaoAndroid)).toBe('kakao');
});

test('네이버·인스타그램·페이스북·라인 앱 안 브라우저는 other', () => {
  for (const ua of [UA.naver, UA.instagram, UA.facebook, UA.line]) expect(inAppBrowser(ua)).toBe('other');
});

test('보통 브라우저(사파리·크롬·삼성 인터넷·웨일·데스크톱)는 null', () => {
  for (const ua of [UA.safari, UA.chromeAndroid, UA.samsung, UA.whale, UA.desktopChrome]) expect(inAppBrowser(ua)).toBeNull();
});

test('안드로이드 카카오톡만 바깥 브라우저 링크를 쓴다', () => {
  expect(isAndroidKakao(UA.kakaoAndroid)).toBe(true);
  expect(isAndroidKakao(UA.kakaoIos)).toBe(false);
  expect(isAndroidKakao(UA.naver)).toBe(false);
  expect(isAndroidKakao(UA.chromeAndroid)).toBe(false);
});

test('kakaoOpenExternalHref 는 주소 전체(해시 포함)를 인코딩한다', () => {
  expect(kakaoOpenExternalHref('https://cleveranawim-source.github.io/jungdeungbu/#/t'))
    .toBe('kakaotalk://web/openExternal?url=https%3A%2F%2Fcleveranawim-source.github.io%2Fjungdeungbu%2F%23%2Ft');
});
