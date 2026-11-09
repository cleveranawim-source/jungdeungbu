import { useState, type FormEvent } from 'react';
import { USING_EMULATOR } from '../lib/env';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field } from '../ui/Field';
import { describeError } from './Toast';
import s from './EmuLogin.module.css';

export interface EmuLoginProps {
  onSignIn(email: string, name: string): Promise<void>;
}

/** 에뮬레이터 전용 로그인 폼(이메일·이름). USING_EMULATOR 가 아니면 아무것도 그리지 않는다. */
export function EmuLogin({ onSignIn }: EmuLoginProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!USING_EMULATOR) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSignIn(email.trim(), name.trim());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="quiet" title="에뮬레이터 로그인">
      <p className={s.note}>개발용 화면이에요. 실제 주소에서는 보이지 않아요.</p>
      <form className={s.form} onSubmit={submit}>
        <Field label="이메일" type="email" inputMode="email" autoComplete="off" required
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@example.com" />
        <Field label="이름" autoComplete="off" required
          value={name} onChange={(e) => setName(e.target.value)} placeholder="김선생" />
        {error && <p className={s.error} role="alert">{error}</p>}
        <Button type="submit" variant="secondary" block busy={busy}>에뮬레이터 로그인</Button>
      </form>
    </Card>
  );
}
