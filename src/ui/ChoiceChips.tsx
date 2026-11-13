import { useId, type ReactNode } from 'react';
import { Icon } from './icons';
import s from './ChoiceChips.module.css';

export interface Choice<V extends string = string> {
  value: V;
  label: ReactNode;
}

interface Base<V extends string> {
  /** 묶음 이름(fieldset legend). 늘 보인다. */
  legend: ReactNode;
  options: readonly Choice<V>[];
  /** 묶음 아래 도움말 */
  hint?: ReactNode;
  disabled?: boolean;
}

export type ChoiceChipsProps<V extends string = string> = Base<V> &
  (
    | { multiple: true; value: readonly V[]; onChange(value: V[]): void }
    | { multiple?: false; value: V; onChange(value: V): void }
  );

/**
 * 알약 모양 고르기. multiple 이면 체크박스(담당 반), 아니면 라디오(역할·반 보기).
 * 진짜 input 을 쓰므로 키보드·화면 읽기가 그대로 동작한다. 고른 것은 색 + 체크 아이콘으로 보인다.
 */
export function ChoiceChips<V extends string>(props: ChoiceChipsProps<V>) {
  const { legend, options, hint, disabled } = props;
  const name = useId();
  const isOn = (v: V) => (props.multiple ? props.value.includes(v) : props.value === v);

  function toggle(v: V) {
    if (props.multiple) {
      const on = props.value.includes(v);
      props.onChange(on ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
    }
  }

  return (
    <fieldset className={s.group} disabled={disabled}>
      <legend className={s.legend}>{legend}</legend>
      <div className={s.chips}>
        {options.map((o, index) => (
          <label key={o.value} className={s.chip}>
            <input
              className={s.input}
              type={props.multiple ? 'checkbox' : 'radio'}
              name={name}
              value={index}
              checked={isOn(o.value)}
              onChange={() => toggle(o.value)}
            />
            <span className={s.face}>
              <span className={s.tick} aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className={s.hint}>{hint}</p>}
    </fieldset>
  );
}
