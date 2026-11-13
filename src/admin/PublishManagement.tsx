import { Disclosure } from '../ui/Disclosure';
import { ConfirmAction } from '../ui/ConfirmAction';
import s from './BulletinEditor.module.css';
export function PublishManagement({hasPublished, hasDraft, busy, takeDown, discard}: {
 hasPublished:boolean; hasDraft:boolean; busy:boolean; takeDown():Promise<void>; discard():Promise<void>;
}) {
 if (!hasPublished) return null;
 return (<div className={s.reviewPanel}>

              <Disclosure title="게시 관리" level={2}>
                <div
                  className={s.fields}
                  onFocus={(event) => {
                    // 저장 줄에 가리지 않게 확인 설명과 버튼을 함께 보여 줘요.
                    (event.target as HTMLElement)
                      .closest('[role="group"]')
                      ?.scrollIntoView({ block: 'center' });
                  }}
                >
                  {hasPublished && (
                    <ConfirmAction
                      label="게시 내리기"
                      message="학생 화면에서 이 주보가 내려가요. 내용은 남아 있어 다시 게시할 수 있어요."
                      confirmLabel="게시를 내려요"
                      disabled={busy}
                      onConfirm={takeDown}
                    />
                  )}
                  {hasDraft && (
                    <ConfirmAction
                      label="초안 버리기"
                      message="서버 초안과 지금 고친 내용을 버리고, 학생이 보고 있는 게시본으로 돌아가요."
                      confirmLabel="초안을 버리고 돌아가기"
                      disabled={busy}
                      onConfirm={discard}
                    />
                  )}
                </div>
              </Disclosure>
            </div>);
}
