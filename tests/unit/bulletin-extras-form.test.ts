import { expect, test } from 'vitest';
import { attToForm, extrasFromSaved, readExtras } from '../../src/admin/bulletinExtrasForm';

const summary = {
  sunday: '2026-11-08',
  classes: [{ name: '1-1', present: 2, total: 3 }, { name: '1-2', present: 1, total: 1 }],
  students: { present: 3, total: 4 },
  teachers: null,
};

test('readExtras: 저장할 출석의 반 줄은 이름·인원뿐이다(반 ID 없음)', () => {
  const form = attToForm(summary);
  // sessionStorage 에 남은 옛 임시본처럼 반 ID가 붙어 와도 저장값에는 실리지 않는다
  const old = { ...form, classes: form.classes.map((c) => ({ ...c, classId: 'classA' })) };
  const r = readExtras({ att: old, newFriends: '', birthdays: '' });
  expect(r.errors).toBeNull();
  expect(r.attendance?.classes).toEqual([{ name: '1-1', present: 2, total: 3 }, { name: '1-2', present: 1, total: 1 }]);
  expect(JSON.stringify(r.attendance)).not.toContain('classA');
  expect(JSON.stringify(r.compare)).not.toContain('classA');
});

test('readExtras: 반 줄이 하나도 없으면 출석을 싣지 않는다(학생 0/0 금지)', () => {
  const r = readExtras({
    att: { sunday: '2026-11-08', classes: [], teachersPresent: '3', teachersTotal: '4' }, newFriends: '', birthdays: '',
  });
  expect(r.errors).toBeNull();
  expect(r.attendance).toBeNull();
});

test('readExtras: 틀린 반 칸은 그 줄의 폼 key 로 알려 준다', () => {
  const form = attToForm(summary);
  form.classes[1] = { ...form.classes[1], present: '9' };
  const r = readExtras({ att: form, newFriends: '', birthdays: '' });
  expect(r.errors?.classes).toEqual([form.classes[1].k]);
});

test('extrasFromSaved → readExtras 가 저장값을 그대로 돌려준다', () => {
  const r = readExtras(extrasFromSaved({ ...summary, teachers: { present: 13, total: 15 } }, { newFriends: ['새봄'], birthdays: [] }));
  expect(r.attendance).toEqual({ ...summary, teachers: { present: 13, total: 15 } });
  expect(r.members).toEqual({ newFriends: ['새봄'], birthdays: [] });
});
