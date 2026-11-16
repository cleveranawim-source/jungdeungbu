import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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

test('주보의 구역 제목(예배 순서·찬양 등)은 프리텐다드', () => {
  expect(rule('src/ui/BulletinView.module.css', '.heading')).toContain('var(--font-display)');
});

test('제목 안의 숫자 세기는 프리텐다드(누를 때 폭이 흔들리지 않게)', () => {
  expect(rule('src/teacher/AttendanceTab.module.css', '.count')).toContain('var(--font-body)');
  expect(rule('src/teacher/TeacherPrayerTab.module.css', '.count')).toContain('var(--font-body)');
});

test('순서표·출석 숫자는 프리텐다드, 중등부 안내 표어는 프리텐다드', () => {
  expect(rule('src/ui/BulletinView.module.css', '.counts')).toContain('var(--font-body)');
  expect(rule('src/ui/InfoCard.module.css', '.motto')).toContain('var(--font-display)');
});


test('표지는 장식용 길 하나를 쓰고 이전 그림·글꼴은 배포하지 않는다', () => {
  const cover = readFileSync('src/ui/BulletinCover.tsx', 'utf8');
  expect(cover.match(/<SundayPath \/>/g)).toHaveLength(1);
  expect(cover).not.toContain('<img');
  expect(readFileSync('src/ui/SundayPath.tsx', 'utf8')).toContain('aria-hidden="true"');
  expect(existsSync('src/assets/walking-together')).toBe(false);
  expect(readFileSync('package.json', 'utf8')).not.toContain('gowun-batang');
  expect(hits(src.filter(p => /\.(css|tsx?)$/.test(p)), /Gowun|고운바탕|--gold|--illustration/)).toEqual([]);
});

test('표지·소식·축하의 글자와 면은 지정한 색 쌍으로 쓴다', () => {
  expect(rule('src/ui/NewsSection.module.css', '.heading')).toContain('var(--section-ink)');
  expect(rule('src/ui/NewsSection.module.css', '.heading')).toContain('var(--section-bg)');
  expect(rule('src/ui/BulletinView.module.css', '.community')).toContain('var(--community-ink)');
  expect(rule('src/ui/BulletinCover.module.css', '.title')).toContain('var(--cover-ink)');
});

test('모든 모듈 CSS가 선언된 토큰만 참조한다', () => {
  const declared = new Set([...readFileSync('src/ui/theme.css', 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  // EditorBar가 측정해 선언하는 --toast-lift 같은 런타임 CSS 변수도 확인해요.
  for (const path of src.filter(p => /\.tsx?$/.test(p))) {
    for (const match of readFileSync(path, 'utf8').matchAll(/\.style\.setProperty\(['"](--[\w-]+)['"]/g)) declared.add(match[1]);
  }
  const paths = src.filter(p => p.endsWith('.module.css'));
  for (const path of paths) {
    const used = [...readFileSync(path, 'utf8').matchAll(/var\((--[\w-]+)/g)].map(m => m[1]);
    expect(used.filter(token => !declared.has(token)), path).toEqual([]);
  }
});


test('새 구역 머리와 안내는 배경에 맞는 글자색을 쓴다', () => {
  const card = readFileSync('src/ui/Card.module.css', 'utf8');
  const intro = readFileSync('src/ui/PageIntro.module.css', 'utf8');
  for (const css of [card,intro]) {
    expect(css).toMatch(/background:\s*var\(--community-bg\);\s*color:\s*var\(--community-ink\)/);
    expect(css).toMatch(/background:\s*var\(--section-soft\);\s*color:\s*var\(--section-soft-ink\)/);
  }
});
test('화면에는 자물쇠 아이콘을 쓰지 않는다', () => {
  expect(hits(src.filter(p => p.endsWith('.tsx')), /name=["']lock["']/)).toEqual([]);
  expect(readFileSync('src/ui/icons.tsx', 'utf8')).not.toMatch(/\block\s*:/);
});
