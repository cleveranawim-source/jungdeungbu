import { useState } from 'react';
import { useGuardedLinkClick } from '../app/leaveGuard';
import { teacherHref } from '../app/router';
import { LinkButton } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { AnnouncementsAdmin } from './AnnouncementsAdmin';
import { BulletinEditor } from './BulletinEditor';
import { ClassesTeachersAdmin } from './ClassesTeachersAdmin';
import { InfoAdmin } from './InfoAdmin';
import { RosterAdmin } from './RosterAdmin';
import { SermonEditor } from './SermonEditor';
import { StatsAdmin } from './StatsAdmin';
import { ADMIN_SECTIONS, findAdminSection } from './sections';
import s from './AdminTab.module.css';

export interface AdminTabProps {
  /** `#/t/admin/{sub}` 의 sub. 모르는 값이면 메뉴 */
  sub?: string;
  /** 로그인한 관리자 uid(자기 자신은 내보내지 못하게) */
  myUid: string;
  /** 이번 주일(yyyy-mm-dd). 주보·설교·광고 편집의 기본 날짜 */
  thisSunday: string;
  /** 내 이름·호칭을 바꿨을 때(화면 위 이름 줄을 새로 그리게) */
  onProfileChanged(): Promise<void>;
}

/** 관리 탭: 메뉴 목록 → 각 화면. 제목(h1)은 TeacherApp 의 Screen 이 그린다. */
export function AdminTab({ sub, myUid, thisSunday, onProfileChanged }: AdminTabProps) {
  const [bulletinDate, setBulletinDate] = useState(thisSunday);
  const section = findAdminSection(sub);
  const guardedClick = useGuardedLinkClick();
  if (!section) return <AdminMenu />;
  return (
    <div className={section.key === 'bulletin' || section.key === 'info' ? s.wide : s.standard}>
      <div className={s.back}>
        <LinkButton href={teacherHref('admin')} variant="ghost" size="sm" icon={<Icon name="back" size={20} />}
          onClick={guardedClick}>
          관리 메뉴
        </LinkButton>
      </div>
      {section.key === 'bulletin' && <BulletinEditor myUid={myUid} thisSunday={thisSunday} initialDate={bulletinDate} onDateChange={setBulletinDate} />}
      {section.key === 'sermon' && <SermonEditor thisSunday={thisSunday} />}
      {section.key === 'announcements' && <AnnouncementsAdmin thisSunday={thisSunday} />}
      {section.key === 'info' && <InfoAdmin />}
      {section.key === 'roster' && <RosterAdmin />}
      {section.key === 'attendance' && <StatsAdmin thisSunday={thisSunday} />}
      {section.key === 'classes' && <ClassesTeachersAdmin myUid={myUid} onProfileChanged={onProfileChanged} />}
      {!section.ready && (
        <EmptyState icon={section.icon} title="준비 중이에요">{section.label} 화면은 곧 채워질 거예요.</EmptyState>
      )}
    </div>
  );
}

function AdminMenu() {
  return (
    <nav aria-label="관리 메뉴" className={s.menu}>
      <ul className={s.list}>
        {ADMIN_SECTIONS.map((x) => (
          <li key={x.key}>
            <a className={s.item} href={teacherHref('admin', x.key)}>
              <span className={s.mark}><Icon name={x.icon} /></span>
              <span className={s.text}>
                <span className={s.label}>
                  {x.label}
                  {!x.ready && <span className={s.soon}>준비 중</span>}
                </span>
                <span className={s.desc}>{x.desc}</span>
              </span>
              <span className={s.chev} aria-hidden="true"><Icon name="chevronRight" size={20} /></span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
