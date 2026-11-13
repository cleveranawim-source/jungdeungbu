import type { ChurchInfo, MemberInfo } from '../types';
import { hasInfoContent, safeHttpUrl, telHref } from '../lib/bulletin';
import { LinkButton } from './Button';
import { Disclosure } from './Disclosure';
import { JourneyLines } from './JourneyLines';
import s from './InfoCard.module.css';

function Phone({ phone }: { phone: string }) {
  const href = telHref(phone);
  return href ? <a className={s.tel} href={href}>{phone}</a> : <span>{phone}</span>;
}

/** 개인 안내는 준비된 members 에서만 그려요. 공개 안내만으로도 완결된 구성이에요. */
export function InfoCard({ info, members }: { info: ChurchInfo; members: MemberInfo | null }) {
  const { motto, place } = info;
  const hasMotto = Boolean(motto.title || motto.subtitle || motto.verse);
  const servants = (members?.servants ?? []).filter((x) => x && (x.role || x.names));
  const contacts = (members?.contacts ?? []).filter((c) => c && (c.label || c.phone));
  const etiquette = (info.etiquette ?? []).filter(Boolean);
  const mapUrl = safeHttpUrl(place.mapUrl);
  const hasPlace = Boolean(place.name || place.address || mapUrl);
  if (!hasInfoContent(info, members)) return null;
  return (
    <section className={s.card} id="church-info" tabIndex={-1} aria-labelledby="info-heading">
      <h2 className={s.heading} id="info-heading">중등부 안내</h2>
      {hasMotto && <div className={s.mottoPanel}>
        <JourneyLines />
        <p className={s.eyebrow}>우리의 표어</p>
        {motto.title && <p className={s.motto}>{motto.title}</p>}
        {motto.subtitle && <p className={s.subtitle}>{motto.subtitle}</p>}
        {motto.verse && <p className={s.verse}>{motto.verse}{motto.ref && <span className={s.ref}> ({motto.ref})</span>}</p>}
      </div>}
      <div className={s.body}>
        {hasPlace && <section className={s.place} aria-labelledby="info-place"><h3 id="info-place">오시는 길</h3>
          {place.name && <p className={s.placeName}>{place.name}</p>}
          {place.address && <p className={s.address}>{place.address}</p>}
          {mapUrl && <LinkButton className={s.map} href={mapUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">지도 보기</LinkButton>}
        </section>}
        {info.churchPhone && <p className={s.churchPhone}><span>교회에 연락해요</span><Phone phone={info.churchPhone} /></p>}
        {etiquette.length > 0 && <Disclosure title="예배 에티켓"><ul className={s.bullets}>{etiquette.map((e, i) => <li key={i}>{e}</li>)}</ul></Disclosure>}
        {servants.length > 0 && <Disclosure title="섬기는 분들"><dl className={s.pairs}>{servants.map((x, i) => <div key={i}><dt>{x.role}</dt><dd>{x.names}</dd></div>)}</dl></Disclosure>}
        {contacts.length > 0 && <Disclosure title="선생님 연락처"><dl className={s.pairs}>{contacts.map((c, i) => <div key={i}><dt>{c.label}</dt><dd>{c.phone && <Phone phone={c.phone} />}</dd></div>)}</dl></Disclosure>}
      </div>
    </section>
  );
}
