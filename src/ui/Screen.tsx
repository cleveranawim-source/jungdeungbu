import type { ReactNode } from 'react';
import s from './Screen.module.css';

export interface ScreenProps {
  /** 화면 제목(h1, 고운바탕). 한 화면에 하나. */
  title?: ReactNode;
  /** 제목 아래 한 줄(날짜·반 이름 등) */
  sub?: ReactNode;
  /** 제목 오른쪽 작은 버튼들(로그아웃 등). size="sm" 버튼을 쓴다. */
  actions?: ReactNode;
  /** 하단 탭 바(<TabBar />). 넣으면 내용이 탭 바 뒤로 숨지 않게 아래 여백이 늘어난다. */
  tabBar?: ReactNode;
  /** 홈·주보처럼 읽기 면과 보조 소식을 나란히 놓는 화면만 넓혀요. */
  layout?: 'default' | 'reading' | 'admin';
  children?: ReactNode;
}

/** 기본 640px, 읽기 화면은 넓을 때 1080px. 안전 영역과 탭 바 여백을 마련해요. */
export function Screen({ title, sub, actions, tabBar, layout = 'default', children }: ScreenProps) {
  return (
    <>
      <div className={[s.screen, layout === 'reading' && s.reading, layout === 'admin' && s.admin, tabBar && s.withTabBar].filter(Boolean).join(' ')}>
        {(title || actions) && (
          <header className={s.head}>
            <div className={s.titles}>
              {title && <h1>{title}</h1>}
              {sub && <p className={s.sub}>{sub}</p>}
            </div>
            {actions && <div className={s.actions}>{actions}</div>}
          </header>
        )}
        <main className={s.main}>{children}</main>
      </div>
      {tabBar}
    </>
  );
}
