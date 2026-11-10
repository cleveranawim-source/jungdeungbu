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
