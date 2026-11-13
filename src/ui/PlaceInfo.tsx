import { useId } from 'react';
import type { ChurchInfo } from '../types';
import { safeHttpUrl, telHref } from '../lib/bulletin';
import { LinkButton } from './Button';
import s from './PlaceInfo.module.css';

/** 개인 번호에도 같은 안전한 전화 링크 규칙을 사용해요. */
export function PhoneLink({ phone }: { phone: string }) {
  const href = telHref(phone);
  return href ? (
    <a className={s.tel} href={href}>
      {phone}
    </a>
  ) : (
    <span>{phone}</span>
  );
}

/** 공개 장소와 교회 번호만 받아요. 구성원 연락처를 섞지 않아요. */
export function PlaceInfo({
  info,
  title = '오시는 길',
  level = 3,
  className,
}: {
  info: Pick<ChurchInfo, 'place' | 'churchPhone'>;
  title?: string;
  level?: 2 | 3;
  className?: string;
}) {
  const id = useId();
  const { place, churchPhone } = info;
  const mapUrl = safeHttpUrl(place.mapUrl);
  if (!place.name && !place.address && !mapUrl && !churchPhone) return null;
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className={className} aria-labelledby={id}>
      <Heading id={id}>{title}</Heading>
      {place.name && <p className={s.name}>{place.name}</p>}
      {place.address && <p className={s.address}>{place.address}</p>}
      <div className={s.actions}>
        {mapUrl && (
          <LinkButton
            href={mapUrl}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            지도 보기
          </LinkButton>
        )}
        {churchPhone && <PhoneLink phone={churchPhone} />}
      </div>
    </section>
  );
}
