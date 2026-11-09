import type { ReactNode } from 'react';
import s from './Screen.module.css';

export interface ScreenProps {
  /** 화면 제목(h1, 둥근 제목 글꼴). 한 화면에 하나. */
  title?: ReactNode;
  /** 제목 아래 한 줄(날짜·반 이름 등) */
  sub?: ReactNode;
  /** 제목 오른쪽 작은 버튼들(로그아웃 등). size="sm" 버튼을 쓴다. */
  actions?: ReactNode;
  /** 하단 탭 바(<TabBar />). 넣으면 내용이 탭 바 뒤로 숨지 않게 아래 여백이 늘어난다. */
  tabBar?: ReactNode;
  children?: ReactNode;
}

/** 모든 화면의 틀: 가운데 640px, 좌우 16px, 안전 영역, 탭 바 여백. */
export function Screen({ title, sub, actions, tabBar, children }: ScreenProps) {
  return (
    <>
      <div className={[s.screen, tabBar && s.withTabBar].filter(Boolean).join(' ')}>
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
