import { TITLE_MAX, TITLE_PRESETS } from '../lib/korean';
import { Field } from '../ui/Field';
import s from './TitleField.module.css';

export interface TitleFieldProps { value: string; onChange(title: string): void }

/**
 * 선생님 호칭: 자주 쓰는 호칭은 눌러서 고르고, 그 밖의 호칭은 직접 적는다(10자 이하).
 * 비워 두면 화면에서 "선생님"으로 보인다.
 */
export function TitleField({ value, onChange }: TitleFieldProps) {
  return (
    <div className={s.wrap}>
      <Field label="호칭" autoComplete="off" value={value} maxLength={TITLE_MAX} placeholder="선생님"
        hint="비워 두면 '선생님'으로 보여요" onChange={(e) => onChange(e.target.value)} />
      <div className={s.presets} role="group" aria-label="자주 쓰는 호칭">
        {TITLE_PRESETS.map((t) => (
          <button key={t} type="button" className={s.preset} aria-pressed={value.trim() === t} onClick={() => onChange(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
