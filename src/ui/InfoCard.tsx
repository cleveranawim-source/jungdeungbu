import type { ChurchInfo, MemberInfo } from '../types';
import { safeHttpUrl, telHref } from '../lib/bulletin';
import { LinkButton } from './Button';
import { Card } from './Card';
import s from './InfoCard.module.css';

/** 번호는 tel: 로 걸 수 있으면 링크, 아니면 글자만. */
function Phone({ phone }: { phone: string }) {
  const href = telHref(phone);
  return href ? <a className={s.tel} href={href}>{phone}</a> : <span>{phone}</span>;
}

/**
 * 중등부 안내: 표어 → 섬기는 분들 → 예배 에티켓 → 오시는 길 → 연락처.
 * 섬기는 분들·연락처의 사람 번호는 잠긴 문서(members)에서 온다. members 가 null 이면 공개 안내만 보인다.
 * 보일 것이 하나도 없으면 아무것도 그리지 않는다.
 */
export function InfoCard({ info, members }: { info: ChurchInfo; members: MemberInfo | null }) {
  const { motto, place } = info;
  const hasMotto = Boolean(motto.title || motto.subtitle || motto.verse);
  // 잠긴 문서는 다듬지 않고 저장된 그대로 오므로 빠진 칸은 빈 목록으로 본다
  const servants = (members?.servants ?? []).filter((x) => x && (x.role || x.names));
  const contacts = (members?.contacts ?? []).filter((c) => c && (c.label || c.phone));
  const etiquette = info.etiquette.filter(Boolean);
  const mapUrl = safeHttpUrl(place.mapUrl);
  const hasPlace = Boolean(place.name || place.address || mapUrl);
  const hasContacts = Boolean(info.churchPhone) || contacts.length > 0;

  if (!hasMotto && servants.length === 0 && etiquette.length === 0 && !hasPlace && !hasContacts) return null;

  return (
    <Card title="중등부 안내">
      {hasMotto && (
        <div className={s.block}>
          {motto.title && <p className={s.motto}>{motto.title}</p>}
          {motto.subtitle && <p className={s.subtitle}>{motto.subtitle}</p>}
          {motto.verse && (
            <p className={s.verse}>
              {motto.verse}
              {motto.ref && <span className={s.ref}> ({motto.ref})</span>}
            </p>
          )}
        </div>
      )}

      {servants.length > 0 && (
        <section className={s.block} aria-labelledby="info-servants">
          <h3 className={s.heading} id="info-servants">섬기는 분들</h3>
          <dl className={s.pairs}>
            {servants.map((x, i) => <div key={i}><dt>{x.role}</dt><dd>{x.names}</dd></div>)}
          </dl>
        </section>
      )}

      {etiquette.length > 0 && (
        <section className={s.block} aria-labelledby="info-etiquette">
          <h3 className={s.heading} id="info-etiquette">예배 에티켓</h3>
          <ul className={s.bullets}>
            {etiquette.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </section>
      )}

      {hasPlace && (
        <section className={s.block} aria-labelledby="info-place">
          <h3 className={s.heading} id="info-place">오시는 길</h3>
          {place.name && <p className={s.placeName}>{place.name}</p>}
          {place.address && <p className={s.address}>{place.address}</p>}
          {mapUrl && (
            <LinkButton className={s.map} href={mapUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
              지도 열기
            </LinkButton>
          )}
        </section>
      )}

      {hasContacts && (
        <section className={s.block} aria-labelledby="info-contacts">
          <h3 className={s.heading} id="info-contacts">연락처</h3>
          <dl className={s.pairs}>
            {info.churchPhone && <div><dt>교회</dt><dd><Phone phone={info.churchPhone} /></dd></div>}
            {contacts.map((c, i) => <div key={i}><dt>{c.label}</dt><dd>{c.phone && <Phone phone={c.phone} />}</dd></div>)}
          </dl>
        </section>
      )}
    </Card>
  );
}
