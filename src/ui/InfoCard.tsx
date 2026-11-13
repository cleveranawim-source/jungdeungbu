import type { ChurchInfo, MemberInfo } from '../types';
import { hasInfoContent } from '../lib/bulletin';
import { PlaceInfo, PhoneLink } from './PlaceInfo';
import { Disclosure } from './Disclosure';
import { JourneyLines } from './JourneyLines';
import s from './InfoCard.module.css';

/** 개인 안내는 준비된 members 에서만 그려요. 공개 안내만으로도 완결된 구성이에요. */
export function InfoCard({ info, members }: { info: ChurchInfo; members: MemberInfo | null }) {
  const { motto } = info;
  const hasMotto = Boolean(motto.title || motto.subtitle || motto.verse);
  const servants = (members?.servants ?? []).filter((x) => x && (x.role || x.names));
  const contacts = (members?.contacts ?? []).filter((c) => c && (c.label || c.phone));
  const etiquette = (info.etiquette ?? []).filter(Boolean);
  if (!hasInfoContent(info, members)) return null;
  return (
    <section className={s.card} id="church-info" tabIndex={-1} aria-labelledby="info-heading">
      <h2 className={s.heading} id="info-heading">
        중등부 안내
      </h2>
      {hasMotto && (
        <div className={s.mottoPanel}>
          <div className={s.mottoCopy}>
            <JourneyLines />
            {motto.title && <p className={s.motto}>{motto.title}</p>}
            {motto.subtitle && <p className={s.subtitle}>{motto.subtitle}</p>}
          </div>
          {motto.verse && (
            <Disclosure title="올해 표어 말씀" tone="cover">
              <p className={s.verse}>
                {motto.verse}
                {motto.ref && <span className={s.ref}> ({motto.ref})</span>}
              </p>
            </Disclosure>
          )}
        </div>
      )}
      <div className={s.body}>
        <PlaceInfo info={info} />
        {etiquette.length > 0 && (
          <Disclosure title="예배 에티켓">
            <ul className={s.bullets}>
              {etiquette.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Disclosure>
        )}
        {servants.length > 0 && (
          <Disclosure title="섬기는 분들">
            <dl className={s.pairs}>
              {servants.map((x, i) => (
                <div key={i}>
                  <dt>{x.role}</dt>
                  <dd>{x.names}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        )}
        {contacts.length > 0 && (
          <Disclosure title="선생님 연락처">
            <dl className={s.pairs}>
              {contacts.map((c, i) => (
                <div key={i}>
                  <dt>{c.label}</dt>
                  <dd>{c.phone && <PhoneLink phone={c.phone} />}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        )}
      </div>
    </section>
  );
}
