import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon } from './icons';
import s from './Field.module.css';

interface Common {
  /** 눈에 보이는 라벨. 자리표시(placeholder)로 라벨을 대신하지 않는다. */
  label: ReactNode;
  /** 입력 아래 도움말 */
  hint?: ReactNode;
  /** 있으면 빨간 테두리 + 아래 문구(화면 읽기에 바로 읽힌다) */
  error?: string | null;
}

function Wrap({ id, label, hint, error, count, children }: Common & { id: string; count?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>{label}</label>
      {children}
      {(hint || error || count) && (
        <div className={s.foot}>
          {error ? (
            <span className={s.error} id={`${id}-msg`} role="alert">
              <Icon name="alert" size={16} />
              {error}
            </span>
          ) : hint ? (
            <span className={s.hint} id={`${id}-msg`}>{hint}</span>
          ) : null}
          {count}
        </div>
      )}
    </div>
  );
}

export interface FieldProps extends Common, Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** React 19: ref 는 그냥 prop 으로 input 에 넘어간다 */
  ref?: Ref<HTMLInputElement>;
}

export function Field({ label, hint, error, className, ...rest }: FieldProps) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={[s.control, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        {...rest}
      />
    </Wrap>
  );
}

export interface TextAreaProps extends Common, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  /** maxLength 와 함께 쓰면 "12/500" 글자 수를 보여 준다 */
  showCount?: boolean;
}

export function TextArea({ label, hint, error, showCount, className, value, maxLength, ...rest }: TextAreaProps) {
  const id = useId();
  const len = typeof value === 'string' ? value.length : 0;
  const count = showCount && maxLength ? (
    <span className={[s.count, len > maxLength && s.over].filter(Boolean).join(' ')} aria-hidden="true">
      {len}/{maxLength}
    </span>
  ) : undefined;
  return (
    <Wrap id={id} label={label} hint={hint} error={error} count={count}>
      <textarea
        id={id}
        className={[s.control, className].filter(Boolean).join(' ')}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        {...rest}
      />
    </Wrap>
  );
}

export interface SelectProps extends Common, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {}

/** 고르기 칸. 보기는 <option> 으로 children 에 넣는다. 모양은 Field 와 같고 오른쪽에 ⌄ 아이콘. */
export function Select({ label, hint, error, className, children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <span className={s.selectWrap}>
        <select
          id={id}
          className={[s.control, s.select, className].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${id}-msg` : undefined}
          {...rest}
        >
          {children}
        </select>
        <span className={s.chevron} aria-hidden="true"><Icon name="chevronDown" size={20} /></span>
      </span>
    </Wrap>
  );
}
