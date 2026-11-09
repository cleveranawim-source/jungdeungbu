import { ChoiceChips } from '../ui/ChoiceChips';
import type { Cls } from './useClassChoice';

/** 반 고르기(알약). 반이 하나뿐이면 그리지 않는다(부르는 쪽이 반 이름을 보여 준다). */
export function ClassPicker({ classes, value, onChange }: { classes: Cls[]; value: string; onChange(id: string): void }) {
  if (classes.length < 2) return null;
  return (
    <ChoiceChips legend="반" options={classes.map((c) => ({ value: c.id, label: c.name }))} value={value} onChange={onChange} />
  );
}
