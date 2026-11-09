import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Look {
  /** primary = 화면에서 가장 중요한 행동 하나. 한 화면에 하나만. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 가로 꽉 채우기 */
  block?: boolean;
  /** 글자 앞 아이콘(<Icon />). 아이콘만 있는 버튼은 aria-label 필수. */
  icon?: ReactNode;
}

function cls({ variant = 'primary', size = 'md', block }: Look, extra?: string) {
  return [s.btn, s[variant], size !== 'md' && s[size], block && s.block, extra].filter(Boolean).join(' ');
}

export interface ButtonProps extends Look, ButtonHTMLAttributes<HTMLButtonElement> {
  /** 처리 중: 누를 수 없고 동그라미가 돈다. */
  busy?: boolean;
  /** 초점 옮기기용(React 19: ref 는 그냥 prop 으로 button 에 넘어간다) */
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant, size, block, icon, busy, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cls({ variant, size, block }, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className={s.spinner} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export interface LinkButtonProps extends Look, AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

/** 다른 화면으로 옮겨 가는 행동은 <a>로(해시 주소). 모양은 Button 과 같다. */
export function LinkButton({ variant, size, block, icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <a className={cls({ variant, size, block }, className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}
