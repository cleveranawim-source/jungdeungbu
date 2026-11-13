import { expect, test } from 'vitest';
import { hasInfoContent } from '../../src/lib/bulletin';
import type { ChurchInfo, MemberInfo } from '../../src/types';
const empty: ChurchInfo = { motto: { title: '', subtitle: '', verse: '', ref: '' }, etiquette: [], place: { name: '', address: '', mapUrl: '' }, churchPhone: '' };
test('빈 안내와 안전하지 않은 지도 주소는 카드·바로가기를 만들지 않는다', () => {
  expect(hasInfoContent(empty, null)).toBe(false);
  expect(hasInfoContent({ ...empty, place: { ...empty.place, mapUrl: 'javascript:alert(1)' } }, null)).toBe(false);
  expect(hasInfoContent({ ...empty, motto: { ...empty.motto, ref: '미가 6:8' } }, null)).toBe(false);
});
test('공개 안내만 있어도 완성되며 구성원 안내는 실제로 준비된 값만 쓴다', () => {
  expect(hasInfoContent({ ...empty, etiquette: ['예배를 함께 준비해요.'] }, null)).toBe(true);
  expect(hasInfoContent({ ...empty, place: { ...empty.place, mapUrl: 'https://example.com/map' } }, null)).toBe(true);
  expect(hasInfoContent(empty, { servants: [{ role: '교사', names: '윤가온' }], contacts: [] })).toBe(true);
  expect(hasInfoContent(empty, { servants: [], contacts: [{ label: '담당', phone: '010-0000-0000' }] })).toBe(true);
  expect(hasInfoContent(empty, {} as MemberInfo)).toBe(false);
});
