import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const css = readFileSync('src/ui/theme.css', 'utf8');

/** `:root { … }` 블록 하나에서 `--이름: 값;` 을 읽는다(주석 제거). */
function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** 밝은 모드는 첫 `:root`, 어두운 모드는 그 위에 `prefers-color-scheme: dark` 의 `:root` 를 덮어쓴 결과. */
export function readTokens(source: string, mode: 'light' | 'dark'): Record<string, string> {
  const light = declarations(source.match(/^:root\s*\{([\s\S]*?)^\}/m)?.[1] ?? '');
  if (mode === 'light') return light;
  const dark = source.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  return { ...light, ...declarations(dark) };
}

function hex(tokens: Record<string, string>, name: string): string {
  let v = tokens[name];
  for (let i = 0; i < 5 && v?.startsWith('var('); i++) v = tokens[v.slice(4, -1).trim()];
  if (!v || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${name} 이(가) 6자리 hex 가 아니에요: ${tokens[name]}`);
  return v;
}

function luminance(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const BODY: [fg: string, bg: string][] = [
  ['--ink', '--bg'], ['--ink', '--card'], ['--muted', '--bg'], ['--muted', '--card'],
  ['--accent-ink', '--accent'], ['--accent-ink', '--accent-press'], ['--accent-text', '--bg'],
  ['--accent-text', '--card'], ['--accent-text', '--accent-soft'], ['--ink', '--accent-soft'],
  ['--notice-ink', '--notice-bg'], ['--danger', '--card'], ['--ok', '--card'],
];
const UI: [fg: string, bg: string][] = [['--line-strong', '--card'], ['--gold', '--card']];

function failures(mode: 'light' | 'dark', pairs: [string, string][], min: number): string[] {
  const t = readTokens(css, mode);
  return pairs
    .map(([fg, bg]) => [fg, bg, contrast(hex(t, fg), hex(t, bg))] as const)
    .filter(([, , r]) => r < min)
    .map(([fg, bg, r]) => `${fg} / ${bg} = ${r.toFixed(2)}`);
}

test.each(['light', 'dark'] as const)('%s 모드 글자 대비 4.5 이상', (mode) => {
  expect(failures(mode, BODY, 4.5)).toEqual([]);
});

test.each(['light', 'dark'] as const)('%s 모드 선·장식 대비 3 이상', (mode) => {
  expect(failures(mode, UI, 3)).toEqual([]);
});

test('햇살 시절 토큰이 지워졌다', () => {
  for (const t of ['--sun', '--sun-halo', '--dur-slow']) expect(css).not.toContain(`${t}:`);
});

test('남색·아이보리·금색 값이 설계서대로다', () => {
  const light = readTokens(css, 'light');
  expect(light['--bg']).toBe('#F7F5F0');
  expect(light['--accent']).toBe('#1B2A41');
  expect(light['--gold']).toBe('#B08A43');
  expect(light['--accent-text']).toBe('#7F6430');
  expect(readTokens(css, 'dark')['--accent']).toBe('#D9BC7E');
});

test('제목은 고운바탕, 본문은 프리텐다드', () => {
  const light = readTokens(css, 'light');
  expect(light['--font-display']).toMatch(/^"Gowun Batang"/);
  expect(light['--font-body']).toMatch(/^"Pretendard Variable", "Pretendard"/);
  expect(css).not.toContain('Jua');
});
