import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** 패턴이 나오는 곳을 "경로:줄" 목록으로 돌려준다. */
function hits(paths: string[], pattern: RegExp): string[] {
  return paths.flatMap((p) =>
    readFileSync(p, 'utf8')
      .split('\n')
      .flatMap((line, i) => (pattern.test(line) ? [`${p}:${i + 1}`] : [])),
  );
}

const src = files('src');

test('햇살 장식과 Jua 가 남지 않는다', () => {
  expect(hits(src, /Sunrise|var\(--sun|Jua|--dur-slow/)).toEqual([]);
});

test('모듈 CSS 에 hex 색이 없다(색은 theme.css 토큰으로만)', () => {
  expect(hits(src.filter((p) => p.endsWith('.module.css')), /#[0-9a-fA-F]{3,8}\b/)).toEqual([]);
});

/** CSS 모듈에서 `.이름 { … }` 블록 하나를 꺼낸다. */
function rule(path: string, selector: string): string {
  const css = readFileSync(path, 'utf8');
  const m = css.match(new RegExp(`^\\${selector}\\s*\\{([^}]*)\\}`, 'm'));
  if (!m) throw new Error(`${path} 에 ${selector} 규칙이 없어요`);
  return m[1];
}

test('주보의 구역 제목(예배 순서·찬양 등)은 고운바탕', () => {
  expect(rule('src/ui/BulletinView.module.css', '.heading')).toContain('var(--font-display)');
});

test('제목 안의 숫자 세기는 프리텐다드(누를 때 폭이 흔들리지 않게)', () => {
  expect(rule('src/teacher/AttendanceTab.module.css', '.count')).toContain('var(--font-body)');
  expect(rule('src/teacher/TeacherPrayerTab.module.css', '.count')).toContain('var(--font-body)');
});

test('순서표·출석 숫자는 프리텐다드, 중등부 안내 표어는 고운바탕', () => {
  expect(rule('src/ui/BulletinView.module.css', '.counts')).toContain('var(--font-body)');
  expect(rule('src/ui/InfoCard.module.css', '.motto')).toContain('var(--font-display)');
});


test('동행 그림은 반응형 WebP이며 작은 그림은 150KB 미만이다', () => {
  const dir = 'src/assets/walking-together';
  for (const size of [480, 800, 1280]) expect(statSync(`${dir}/${size}.webp`).size).toBeLessThan(150 * 1024);
  expect(readFileSync(`${dir}/prompt.txt`, 'utf8').trim().length).toBeGreaterThan(50);
  const cover = readFileSync('src/ui/IllustratedCover.tsx', 'utf8');
  expect(cover).toContain('srcSet=');
  expect(cover).toContain('alt=""');
});

test('표지·소식·축하의 글자와 면은 지정한 색 쌍으로 쓴다', () => {
  expect(rule('src/ui/NewsSection.module.css', '.heading')).toContain('var(--gold-panel-ink)');
  expect(rule('src/ui/NewsSection.module.css', '.heading')).toContain('var(--gold-panel)');
  expect(rule('src/ui/BulletinView.module.css', '.community')).toContain('var(--sage-ink)');
  expect(rule('src/ui/IllustratedCover.module.css', '.cover')).toContain('var(--cover-ink)');
});

test('관리 작성 화면도 선언된 토큰만 참조한다', () => {
  const declared = new Set([...readFileSync('src/ui/theme.css', 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const paths = ['EditorLayout', 'OrderEditor', 'BulletinEditor', 'InfoAdmin'].map(n => `src/admin/${n}.module.css`);
  for (const path of paths) {
    const used = [...readFileSync(path, 'utf8').matchAll(/var\((--[\w-]+)/g)].map(m => m[1]);
    expect(used.filter(token => !declared.has(token)), path).toEqual([]);
  }
});


test('새 구역 머리와 안내는 배경에 맞는 글자색을 쓴다', () => {
  const card = readFileSync('src/ui/Card.module.css', 'utf8');
  const intro = readFileSync('src/ui/PageIntro.module.css', 'utf8');
  for (const css of [card,intro]) {
    expect(css).toMatch(/background:\s*var\(--sage-bg\);\s*color:\s*var\(--sage-ink\)/);
    expect(css).toMatch(/background:\s*var\(--gold-panel\);\s*color:\s*var\(--gold-panel-ink\)/);
  }
});
test('화면에는 자물쇠 아이콘을 쓰지 않는다', () => {
  expect(hits(src.filter(p => p.endsWith('.tsx')), /name=["']lock["']/)).toEqual([]);
});
