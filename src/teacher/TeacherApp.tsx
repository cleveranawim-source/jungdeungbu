import { useRef, useState } from 'react';
import { withTitle } from '../lib/korean';
import { AdminTab } from '../admin/AdminTab';
import { findAdminSection } from '../admin/sections';
import { EmuLogin } from '../app/EmuLogin';
import { LeaveGuardProvider, useGuardedNavigate } from '../app/leaveGuard';
import { teacherHref } from '../app/router';
import { TabBar, type TabItem } from '../app/TabBar';
import { describeError, useToast } from '../app/Toast';
import { useAuthRole, type AuthUser } from '../app/useAuthRole';
import { useTodaySunday } from '../app/useTodaySunday';
import { inAppBrowser, isAndroidKakao, kakaoOpenExternalHref } from '../lib/inAppBrowser';
import type { Teacher } from '../types';
import { Button, LinkButton } from '../ui/Button';
import { ConfirmAction } from '../ui/ConfirmAction';
import { EmptyState } from '../ui/EmptyState';
import { Field } from '../ui/Field';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { Screen } from '../ui/Screen';
import { IllustratedCover } from '../ui/IllustratedCover';
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
    return (
      <Screen title="선생님">
        <Loading>로그인을 확인하는 중이에요</Loading>
      </Screen>
    );
  }
  if (role.error) return <AuthError message={role.error} onSignOut={role.signOut} />;
  if (role.status === 'signedOut') return <SignIn onGoogle={role.signIn} onEmu={role.signInEmu} />;
  if (role.status === 'notInvited' || !role.teacher || !role.user) {
    return <NotInvited email={role.user?.email ?? ''} onSignOut={role.signOut} />;
  }
  return (
    <LeaveGuardProvider>
      <Ready
        user={role.user}
        teacher={role.teacher}
        tab={tab}
        sub={sub}
        onSignOut={role.signOut}
        onProfileChanged={role.refreshTeacher}
      />
    </LeaveGuardProvider>
  );
}

type SignOut = (force?: boolean) => Promise<'unsynced' | void>;

const UNSYNCED = '아직 저장되지 않은 출석이 있어요. 연결된 뒤 다시 로그아웃해 주세요';

/**
 * 로그아웃 버튼. 서버에 닿지 않은 출석이 있으면 로그아웃하지 않고 onUnsynced(없으면 오류 토스트).
 * 로그아웃되면 화면을 새로 불러오므로 busy 는 그대로 둔다.
 */
function SignOutButton({
  onSignOut,
  onUnsynced,
  variant = 'secondary',
}: {
  onSignOut: SignOut;
  onUnsynced?(): void;
  variant?: 'secondary' | 'ghost';
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size="sm"
      busy={busy}
      icon={<Icon name="logout" size={18} />}
      onClick={async () => {
        setBusy(true);
        try {
          if ((await onSignOut()) === 'unsynced') {
            setBusy(false);
            if (onUnsynced) onUnsynced();
            else show(UNSYNCED, 'error');
          }
        } catch (e) {
          show(describeError(e), 'error');
          setBusy(false);
        }
      }}
    >
      로그아웃
    </Button>
  );
}

/** 로그아웃하려는데 서버에 닿지 않은 출석이 남았을 때: 다시 시도 / 저장 안 하고 로그아웃(확인 뒤). */
function UnsyncedNotice({ onSignOut }: { onSignOut: SignOut }) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    try {
      if ((await onSignOut()) === 'unsynced') {
        setBusy(false);
        show('아직 저장되지 않았어요. 연결을 확인한 뒤 다시 해 주세요', 'error');
      }
    } catch (e) {
      show(describeError(e), 'error');
      setBusy(false);
    }
  }
  return (
    <div className={s.unsynced} role="alert">
      <p className={s.unsyncedText}>
        <Icon name="offline" size={20} />
        <span>{UNSYNCED}</span>
      </p>
      <div className={s.row}>
        <Button
          variant="secondary"
          size="sm"
          busy={busy}
          icon={<Icon name="refresh" size={18} />}
          onClick={retry}
        >
          다시 시도
        </Button>
        <ConfirmAction
          label="저장 안 하고 로그아웃"
          icon="logout"
          confirmLabel="지우고 로그아웃하기"
          disabled={busy}
          message="저장되지 않은 출석은 이 기기에서 지워지고 되돌릴 수 없어요."
          onConfirm={async () => {
            await onSignOut(true);
          }}
        />
      </div>
    </div>
  );
}

function SignIn({
  onGoogle,
  onEmu,
}: {
  onGoogle(): Promise<void>;
  onEmu(email: string, name: string): Promise<void>;
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  async function google() {
    setBusy(true);
    try {
      await onGoogle();
    } catch (e) {
      const code =
        typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
      // 사용자가 로그인 창을 닫은 것은 오류가 아니다
      if (!code.endsWith('popup-closed-by-user') && !code.endsWith('cancelled-popup-request'))
        show(describeError(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  // 카카오톡 등 앱 안 브라우저에서는 Google 이 로그인을 막는다 → 버튼 대신 바깥 브라우저로 여는 법
  const [inApp] = useState(() => inAppBrowser(navigator.userAgent));
  return (
    <Screen title="선생님 로그인" sub="초대받은 Google 계정으로 들어와요" layout="reading">
      <div className={s.loginLayout}>
        <IllustratedCover
          title={
            <>
              함께
              <br />
              돌보는
              <br />
              중등부
            </>
          }
        >
          <p>아이들의 예배와 한 주를 함께 준비해요.</p>
        </IllustratedCover>
        <div className={s.loginActions}>
          {inApp ? (
            <InAppNotice kakao={inApp === 'kakao'} />
          ) : (
            <div className={s.signIn}>
              <Button size="lg" block busy={busy} icon={<Icon name="login" />} onClick={google}>
                Google로 로그인
              </Button>
              <p className={s.note}>
                학생은 로그인하지 않아요. 선생님이 보내 준 링크로 바로 들어와요.
              </p>
            </div>
          )}
          <EmuLogin onSignIn={onEmu} />
        </div>
      </div>
    </Screen>
  );
}

/** 앱 안 브라우저: 오른쪽 위 메뉴로 바깥 브라우저에서 열기 안내 + 주소 복사(+ 안드로이드 카카오톡은 Chrome으로 열기). */
function InAppNotice({ kakao }: { kakao: boolean }) {
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const url = location.href;
  const external = isAndroidKakao(navigator.userAgent) ? kakaoOpenExternalHref(url) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      show('주소를 복사했어요. Safari나 Chrome 주소창에 붙여 넣어 주세요');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      show('복사하지 못했어요. 주소 칸을 길게 눌러 복사해 주세요', 'error');
    }
  }

  return (
    <div className={s.signIn}>
      <p className={s.inApp} role="note">
        <Icon name="info" size={20} />
        <span>
          {kakao ? '카카오톡' : '이 앱'} 안 브라우저에서는 Google 로그인이 안 돼요. 오른쪽 위
          메뉴에서 'Safari/Chrome으로 열기'를 눌러 주세요
        </span>
      </p>
      {external && (
        <LinkButton href={external} size="lg" block icon={<Icon name="link" />}>
          Chrome으로 열기
        </LinkButton>
      )}
      <Field
        ref={inputRef}
        label="이 화면 주소"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        hint="길게 눌러 직접 복사할 수도 있어요"
      />
      <Button
        variant={external ? 'secondary' : 'primary'}
        size="lg"
        block
        icon={<Icon name="copy" size={20} />}
        onClick={copy}
      >
        주소 복사
      </Button>
    </div>
  );
}

function NotInvited({ email, onSignOut }: { email: string; onSignOut: SignOut }) {
  return (
    <Screen title="선생님 로그인">
      <EmptyState
        icon="mail"
        title="아직 초대되지 않은 계정이에요"
        action={<SignOutButton onSignOut={onSignOut} />}
      >
        관리자에게 이메일을 알려주세요.
        {email && <span className={s.email}>{email}</span>}
      </EmptyState>
    </Screen>
  );
}

function AuthError({ message, onSignOut }: { message: string; onSignOut: SignOut }) {
  return (
    <Screen title="선생님 로그인">
      <EmptyState
        icon="alert"
        title="로그인을 확인하지 못했어요"
        action={
          <div className={s.row}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="refresh" size={18} />}
              onClick={() => location.reload()}
            >
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

function Ready({
  user,
  teacher,
  tab,
  sub,
  onSignOut,
  onProfileChanged,
}: {
  user: AuthUser;
  teacher: Teacher;
  tab: string;
  sub?: string;
  onSignOut: SignOut;
  onProfileChanged(): Promise<void>;
}) {
  const [unsynced, setUnsynced] = useState(false);
  const isAdmin = teacher.role === 'admin';
  const items = isAdmin ? [...TABS, ADMIN_TAB] : TABS;
  const current = items.find((t) => t.key === tab) ?? items[0];
  const section = current.key === 'admin' ? findAdminSection(sub) : undefined;
  // "이번 주" = 가장 가까운 주일. 날이 바뀌거나 화면이 다시 보일 때만 다시 계산
  const thisSunday = useTodaySunday();
  const props: TeacherTabProps = { uid: user.uid, teacher, thisSunday, sub };
  const navigate = useGuardedNavigate();

  let body;
  if (current.key === 'admin')
    body = (
      <AdminTab
        sub={sub}
        myUid={user.uid}
        thisSunday={thisSunday}
        onProfileChanged={onProfileChanged}
      />
    );
  else if (current.key === 'attendance') body = <AttendanceTab {...props} />;
  else if (current.key === 'class') body = <ClassTab {...props} />;
  else if (current.key === 'bulletin') body = <BulletinTab {...props} />;
  else body = <TeacherPrayerTab {...props} />;

  return (
    <Screen
      layout={current.key === 'admin' ? 'admin' : 'reading'}
      title={section?.label ?? current.label}
      sub={withTitle(teacher.name, teacher.title)}
      actions={<SignOutButton onSignOut={onSignOut} onUnsynced={() => setUnsynced(true)} />}
      tabBar={
        <TabBar
          items={items}
          current={current.key}
          label="교사 메뉴"
          onChange={(k) => navigate(teacherHref(k))}
        />
      }
    >
      {unsynced && <UnsyncedNotice onSignOut={onSignOut} />}
      {body}
    </Screen>
  );
}
