import { useState } from 'react';
import { BULLETIN_BRAND } from '../app/brand';
import type { Announcement, ChurchInfo, MemberInfo, Sermon, WithId } from '../types';
import { BulletinView } from '../ui/BulletinView';
import { InfoCard } from '../ui/InfoCard';
import { Disclosure } from '../ui/Disclosure';
import type { readForm } from './bulletinEditorForm';
import s from './BulletinEditor.module.css';
export function BulletinPreview({
  date,
  read,
  sermon,
  announcements,
  info,
}: {
  date: string;
  read: ReturnType<typeof readForm>;
  sermon: Sermon | null;
  announcements: WithId<Announcement>[];
  info?: { church: ChurchInfo; members: MemberInfo | null };
}) {
  const [publicPreview, setPublicPreview] = useState(false);
  return (
    <div className={s.reviewPanel}>
      <Disclosure title="게시 전 미리보기" level={2}>
        {read.errors ? (
          <p>미리보기 전에 출석 인원과 생일을 확인해 주세요.</p>
        ) : (
          <>
            <fieldset className={s.previewChoice}>
              <legend>미리보기 범위</legend>
              <label>
                <input
                  type="radio"
                  name="preview"
                  checked={!publicPreview}
                  onChange={() => setPublicPreview(false)}
                />
                개인 링크 화면
              </label>
              <label>
                <input
                  type="radio"
                  name="preview"
                  checked={publicPreview}
                  onChange={() => setPublicPreview(true)}
                />
                공개 안내만
              </label>
            </fieldset>
            <div className={s.previewRead}>
              <BulletinView
                bulletin={{ date, ...read.doc }}
                sermon={sermon}
                members={publicPreview ? null : read.members}
                announcements={announcements}
                coverLabel={BULLETIN_BRAND.label}
                coverDescription={BULLETIN_BRAND.description}
              />
              {info && (
                <InfoCard info={info.church} members={publicPreview ? null : info.members} />
              )}
            </div>
          </>
        )}
      </Disclosure>
    </div>
  );
}
