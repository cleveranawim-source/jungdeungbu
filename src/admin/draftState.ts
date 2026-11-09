// useEditorDraft 의 순수한 부분(React 없이 시험한다).

export interface DraftState<T> {
  /** `${prefix}:${날짜}` */
  key: string;
  /** 서버에 저장된 값(이것과 다르면 저장 안 한 내용) */
  base: T;
  /** 지금 화면의 폼 */
  value: T;
  /** 열 때 sessionStorage 에서 되살렸는지 */
  recovered: boolean;
}

/**
 * 폼 열기. 같은 날짜로 이미 열려 있으면 그대로.
 * 복구본(stored)은 모양이 맞고(isValid) 저장값과 다를 때만 쓴다. 모양이 깨졌으면 조용히 버린다.
 */
export function openDraft<T>(
  prev: DraftState<T> | null,
  key: string,
  base: T,
  stored: unknown,
  same: (a: T, b: T) => boolean,
  isValid: (x: unknown) => x is T,
): DraftState<T> {
  if (prev && prev.key === key) return prev;
  const ok = stored !== null && stored !== undefined && isValid(stored);
  const recovered = ok && !same(stored, base);
  return { key, base, value: recovered ? stored : base, recovered };
}

/**
 * 저장이 끝났을 때. sent 는 저장을 누른 순간의 폼으로 만든 값(서버에 실제로 간 것).
 * 그 사이(오프라인이면 한참) 더 고친 내용이 있으면 화면 값은 그대로 두고 저장값만 바꾼다 — 더 고친 것은 계속 "저장 안 한 내용".
 * 다른 날짜로 옮겨 간 뒤 늦게 끝난 저장이면 아무것도 바꾸지 않는다.
 */
export function afterSave<T>(
  prev: DraftState<T> | null,
  key: string,
  sent: T,
  same: (a: T, b: T) => boolean,
): DraftState<T> | null {
  if (!prev || prev.key !== key) return prev;
  const editedSince = !same(prev.value, sent);
  return { key, base: sent, value: editedSince ? prev.value : sent, recovered: false };
}
