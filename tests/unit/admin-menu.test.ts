import { expect, test } from 'vitest';
import { ADMIN_MENU_GROUPS, ADMIN_SECTIONS } from '../../src/admin/sections';

test('모든 관리 화면이 메뉴 그룹에 정확히 한 번 나온다', () => {
  const keys = ADMIN_MENU_GROUPS.flatMap(group => group.keys);
  expect([...keys].sort()).toEqual(ADMIN_SECTIONS.map(section => section.key).sort());
  expect(new Set(keys).size).toBe(keys.length);
});
