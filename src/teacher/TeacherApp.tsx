import { useMemo, useState } from 'react';
import { AdminTab } from '../admin/AdminTab';
import { findAdminSection } from '../admin/sections';
import { EmuLogin } from '../app/EmuLogin';
import { LeaveGuardProvider, useGuardedNavigate } from '../app/leaveGuard';
import { teacherHref } from '../app/router';
import { TabBar, type TabItem } from '../app/TabBar';
import { describeError, useToast } from '../app/Toast';
import { useAuthRole, type AuthUser } from '../app/useAuthRole';
import { nearestSunday, toDateId } from '../lib/dates';
import type { Teacher } from '../types';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { Screen } from '../ui/Screen';
import { AttendanceTab } from './AttendanceTab';
import { BulletinTab } from './BulletinTab';
import { ClassTab } from './ClassTab';
import { TeacherPrayerTab } from './TeacherPrayerTab';
import type { TeacherTabProps } from './types';
import s from './TeacherApp.module.css';

export interface TeacherAppProps {
  /** 주소의 탭(검사 안 된 문자열). 모르는 값·권한 없는 탭이면 출석 */
  tab: string;
  /** 탭 안의 화면: 관리 `#/t/admin/{화면}`, 우리 반 `#/t/class/{학생 토큰}`, 주보 `#/t/bulletin/{날짜}` */
  sub?: string;
}

export type TeacherTab = 'attendance' | 'class' | 'prayer' | 'bulletin' | 'admin';

const TABS: readonly TabItem<TeacherTab>[] = [
  { key: 'attendance', label: '출석', icon: <Icon name="attendance" /> },
  { key: 'class', label: '우리 반', icon: <Icon name="class" /> },
  { key: 'prayer', label: '기도', icon: <Icon name="prayer" /> },
  { key: 'bulletin', label: '주보', icon: <Icon name="bulletin" /> },
];
const ADMIN_TAB: TabItem<TeacherTab> = { key: 'admin', label: '관리', icon: <Icon name="admin" /> };

export function TeacherApp({ tab, sub }: TeacherAppProps) {
  const role = useAuthRole();

  if (role.status === 'loading') {
    return <Screen title="선생님"><Loading>로그인을 확인하는 중이에요</Loading></Screen>;
  }
  if (role.error) return <AuthError message={role.error} onSignOut={role.signOut} />;
  if (role.status === 'signedOut') return <SignIn onGoogle={role.signIn} onEmu={role.signInEmu} />;
  if (role.status === 'notInvited' || !role.teacher || !role.user) {
    return <NotInvited email={role.user?.email ?? ''} onSignOut={role.signOut} />;
  }
  return (
    <LeaveGuardProvider>
      <Ready user={role.user} teacher={role.teacher} tab={tab} sub={sub} onSignOut={role.signOut} />
    </LeaveGuardProvider>
  );
}

function SignOutButton({ onSignOut, variant = 'secondary' }: { onSignOut(): Promise<void>; variant?: 'secondary' | 'ghost' }) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant={variant} size="sm" busy={busy} icon={<Icon name="logout" size={18} />}
      onClick={async () => {
        setBusy(true);
        try { await onSignOut(); } catch (e) { show(describeError(e), 'error'); setBusy(false); }
      }}>
      로그아웃
    </Button>
  );
}

function SignIn({ onGoogle, onEmu }: { onGoogle(): Promise<void>; onEmu(email: string, name: string): Promise<void> }) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  async function google() {
    setBusy(true);
    try {
      await onGoogle();
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
      // 사용자가 로그인 창을 닫은 것은 오류가 아니다
      if (!code.endsWith('popup-closed-by-user') && !code.endsWith('cancelled-popup-request')) show(describeError(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="선생님 로그인" sub="초대받은 Google 계정으로 들어와요">
      <div className={s.signIn}>
        <Button size="lg" block busy={busy} icon={<Icon name="login" />} onClick={google}>Google로 로그인</Button>
        <p className={s.note}>학생은 로그인하지 않아요. 선생님이 보내 준 링크로 바로 들어와요.</p>
      </div>
      <EmuLogin onSignIn={onEmu} />
    </Screen>
  );
}

function NotInvited({ email, onSignOut }: { email: string; onSignOut(): Promise<void> }) {
  return (
    <Screen title="선생님 로그인">
      <EmptyState icon="mail" title="등록되지 않은 계정입니다" action={<SignOutButton onSignOut={onSignOut} />}>
        관리자에게 이메일을 알려주세요.
        {email && <span className={s.email}>{email}</span>}
      </EmptyState>
    </Screen>
  );
}

function AuthError({ message, onSignOut }: { message: string; onSignOut(): Promise<void> }) {
  return (
    <Screen title="선생님 로그인">
      <EmptyState
        icon="alert"
        title="로그인을 확인하지 못했어요"
        action={
          <div className={s.row}>
            <Button variant="secondary" size="sm" icon={<Icon name="refresh" size={18} />} onClick={() => location.reload()}>
              다시 시도
            </Button>
            <SignOutButton onSignOut={onSignOut} variant="ghost" />
          </div>
        }
      >
        {message}
      </EmptyState>
    </Screen>
  );
}

function Ready({ user, teacher, tab, sub, onSignOut }: {
  user: AuthUser; teacher: Teacher; tab: string; sub?: string; onSignOut(): Promise<void>;
}) {
  const isAdmin = teacher.role === 'admin';
  const items = isAdmin ? [...TABS, ADMIN_TAB] : TABS;
  const current = items.find((t) => t.key === tab) ?? items[0];
  const section = current.key === 'admin' ? findAdminSection(sub) : undefined;
  // "이번 주" = 가장 가까운 주일. 화면이 열려 있는 동안은 고정
  const thisSunday = useMemo(() => toDateId(nearestSunday(new Date())), []);
  const props: TeacherTabProps = { uid: user.uid, teacher, thisSunday, sub };
  const navigate = useGuardedNavigate();

  let body;
  if (current.key === 'admin') body = <AdminTab sub={sub} myUid={user.uid} thisSunday={thisSunday} />;
  else if (current.key === 'attendance') body = <AttendanceTab {...props} />;
  else if (current.key === 'class') body = <ClassTab {...props} />;
  else if (current.key === 'bulletin') body = <BulletinTab {...props} />;
  else body = <TeacherPrayerTab {...props} />;

  return (
    <Screen
      title={section?.label ?? current.label}
      sub={`${teacher.name} 선생님`}
      actions={<SignOutButton onSignOut={onSignOut} />}
      tabBar={
        <TabBar items={items} current={current.key} label="교사 메뉴"
          onChange={(k) => navigate(teacherHref(k))} />
      }
    >
      {body}
    </Screen>
  );
}
