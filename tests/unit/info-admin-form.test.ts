import { expect, test } from 'vitest';
import { EMPTY_CHURCH_INFO } from '../../src/types';
import { fromSaved, readForm, snapshot } from '../../src/admin/infoAdminForm';
test('공개 안내와 개인 이름·전화는 별도 문서 모양으로 나뉜다', () => {
  const members = {
    servants: [{ role: '교사', names: '서로운, 나이든' }],
    contacts: [{ label: '담당', phone: '010-0000-0000' }],
  };
  const f = fromSaved(EMPTY_CHURCH_INFO, members);
  f.title = ' 동행 ';
  f.etiquette = '9:30 예배\n\n서로 반겨요';
  const r = readForm(f);
  expect(r.members).toEqual(members);
  expect(r.church.motto.title).toBe('동행');
  expect(r.church.etiquette).toEqual(['9:30 예배', '서로 반겨요']);
  expect(JSON.stringify(r.church)).not.toContain('서로운');
  expect(JSON.stringify(r.church)).not.toContain('010-');
});
test('지도 링크 검증은 저장 전 막을 신호를 돌려주며 폼 key는 변경으로 세지 않는다', () => {
  const f = fromSaved(EMPTY_CHURCH_INFO, null);
  f.mapUrl = 'javascript:alert(1)';
  expect(readForm(f).mapInvalid).toBe(true);
  f.mapUrl = 'https://example.com/map';
  expect(readForm(f).mapInvalid).toBe(false);
  expect(snapshot(fromSaved(EMPTY_CHURCH_INFO, null))).toBe(
    snapshot(fromSaved(EMPTY_CHURCH_INFO, null)),
  );
});
