import { ChoiceChips } from '../ui/ChoiceChips';
import { Select } from '../ui/Field';
import type { Cls } from './useClassChoice';

/** 적은 반은 바로 고르고, 네 반부터는 기본 선택 칸을 쓴다. DOM 값은 ID 대신 순번이다. */
export function ClassPicker({ classes, value, onChange }: { classes: Cls[]; value: string; onChange(id: string): void }) {
  if (classes.length < 2) return null;
  if (classes.length > 3) {
    return (
      <Select label="반" value={classes.findIndex(c => c.id === value)}
        onChange={e => {
          const chosen = classes[Number(e.target.value)];
          if (chosen) onChange(chosen.id);
        }}>
        {classes.map((c, index) => <option key={c.id} value={index}>{c.name}</option>)}
      </Select>
    );
  }
  return (
    <ChoiceChips legend="반" options={classes.map((c) => ({ value: c.id, label: c.name }))} value={value} onChange={onChange} />
  );
}
