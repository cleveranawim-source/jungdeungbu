import { expect, test } from 'vitest';
import { EMPTY_BULLETIN_EXTRAS } from '../../src/types';
import {
  comparable,
  fromSaved,
  isForm,
  readForm,
  previewOrder,
} from '../../src/admin/bulletinEditorForm';
const content = {
  ...EMPTY_BULLETIN_EXTRAS,
  order: [{ type: '설교', title: '', detail: '', standing: true }],
  hymns: ['함께 걸어요'],
  scripture: '미가 6:8',
  sermonTitle: '동행',
};
test('왕복 시 일어서기·예배위원과 개인 소식을 유지하고 화면 key를 저장하지 않는다', () => {
  const members = { newFriends: ['서로운'], birthdays: [{ name: '나이든', date: '11-20' }] };
  const form = fromSaved({ ...content, nextServers: [{ role: '기도', name: '서로운' }] }, members);
  const read = readForm(form);
  expect(read.errors).toBeNull();
  expect(read.members).toEqual(members);
  expect(read.doc.order).toEqual(content.order);
  expect(read.doc.nextServers).toEqual([{ role: '기도', name: '서로운' }]);
  expect(JSON.stringify(read.doc)).not.toContain(form.order[0].k);
  expect(read.doc).not.toHaveProperty('published');
  expect(read.doc).not.toHaveProperty('newFriends');
});
test('출석은 기존 readExtras 경로로 합산하고 반 ID를 전달하지 않는다', () => {
  const form = fromSaved(content, null);
  form.att = {
    sunday: '2026-11-08',
    classes: [
      { k: 'form-key', name: '1-1', present: '2', total: '3', classId: 'private-key' } as never,
    ],
    teachersPresent: '',
    teachersTotal: '',
  };
  const read = readForm(form);
  expect(read.doc.attendance?.students).toEqual({ present: 2, total: 3 });
  expect(JSON.stringify(read.doc)).not.toContain('private-key');
  expect(read.doc.attendance?.teachers).toBeNull();
});
test('틀린 숫자·생일은 오류와 비교용 입력으로 남아 조용히 0이 되지 않는다', () => {
  const form = fromSaved(content, null);
  form.birthdays = '잘못된 날짜';
  form.att = {
    sunday: '2026-11-08',
    classes: [{ k: 'a', name: '1-1', present: '넷', total: '3' }],
    teachersPresent: '',
    teachersTotal: '',
  };
  expect(readForm(form).errors).toEqual({ classes: ['a'], teachers: false, birthdays: true });
  expect(JSON.stringify(comparable(form))).toContain('넷');
  expect(JSON.stringify(comparable(form))).toContain('잘못된 날짜');
});
test('복구본 모양이 깨지면 거절하고 새 화면 key는 dirty로 세지 않는다', () => {
  expect(isForm({ order: null, sermonTitle: 3 })).toBe(false);
  const a = fromSaved(content, null);
  const b = fromSaved(content, null);
  expect(isForm(a)).toBe(true);
  expect(comparable(a)).toEqual(comparable(b));
});

test('연결 순서 미리보기는 공백만 적은 내용도 저장 후 표시와 똑같이 채운다', () => {
  const rows = [
    { k: 'empty', type: ' ', title: '', detail: '', standing: false },
    { k: 'reading', type: ' 성경봉독 ', title: ' ', detail: '', standing: false },
    { k: 'sermon', type: '설교', title: ' ', detail: '', standing: false },
    { k: 'manual', type: '설교', title: ' 직접 적은 제목 ', detail: '', standing: false },
  ];
  const preview = previewOrder(rows, ' 미가 6:8 ', ' 동행 ');
  expect(preview.get('empty')).toBeUndefined();
  expect(preview.get('reading')).toMatchObject({ title: '미가 6:8', from: 'scripture' });
  expect(preview.get('sermon')).toMatchObject({ title: '동행', from: 'sermon' });
  expect(preview.get('manual')).toMatchObject({ title: '직접 적은 제목' });
  expect(preview.get('manual')).not.toHaveProperty('from');
});
