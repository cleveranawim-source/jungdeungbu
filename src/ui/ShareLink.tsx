import { useRef } from 'react';
import { studentHref } from '../app/router';
import { useToast } from '../app/Toast';
import { Button } from './Button';
import { Field } from './Field';
import { Icon } from './icons';
import s from './ShareLink.module.css';

export interface ShareLinkProps {
  token: string;
  /** 학생 이름(보내는 글 "김하늘아, 중등부 앱이야 → 주소") */
  name: string;
}

/** 학생 링크 주소(이 앱이 열린 주소 기준) */
export function studentUrl(token: string): string {
  return location.origin + location.pathname + studentHref(token);
}

/**
 * 학생 링크 보내기. 공유 시트가 있으면(휴대폰) 그걸로, 없으면 클립보드에 복사하고 토스트.
 * 주소는 읽기 전용 칸에도 보여서 길게 눌러 직접 복사할 수 있다.
 */
export function ShareLink({ token, name }: ShareLinkProps) {
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const url = studentUrl(token);
  const text = `${name}아, 중등부 앱이야 → ${url}`;

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // 사용자가 닫음
        // 공유가 막힌 환경이면 복사로 넘어간다
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      show('링크를 복사했어요');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      show('복사하지 못했어요. 주소 칸을 길게 눌러 복사해 주세요', 'error');
    }
  }

  return (
    <div className={s.share}>
      <Field ref={inputRef} label="학생 링크" readOnly value={url} className={s.url}
        onFocus={(e) => e.currentTarget.select()} hint="길게 눌러 직접 복사할 수도 있어요" />
      <Button variant="secondary" block icon={<Icon name="share" size={20} />} onClick={share}>링크 공유</Button>
    </div>
  );
}
