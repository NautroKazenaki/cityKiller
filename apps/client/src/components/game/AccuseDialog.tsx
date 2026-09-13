import { useState } from 'react';
import type { Citizen, Victim } from '@citykiller/shared';
import { MOTIVE_DESCRIPTORS } from '@citykiller/shared';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';
import { groupRing, monogram } from '@/design/city';
import { GROUP_LABELS, districtName } from '@/lib/labels';

interface AccuseDialogProps {
  open: boolean;
  forced: boolean;
  citizens: Citizen[];
  /** Все жители партии, включая мёртвых — по ним подписываются жертвы */
  allCitizens: Citizen[];
  /** Жертвы по порядку: главная улика против мотива */
  victims: Victim[];
  /** id 6 мотивов-кандидатов, среди которых один настоящий */
  motiveOptions: string[];
  /** Мотивы, которые детектив вычеркнул по ходу партии */
  crossedMotives: string[];
  /** Журнал допросов — под рукой, чтобы не вспоминать ответы по памяти */
  journal: React.ReactNode;
  onSubmit: (job: string, motiveId: string) => void;
  onClose: () => void;
}

/**
 * Обвинение. Модалка оправдана: назвать убийцу можно один раз, ошибка в любом
 * из двух пунктов — поражение.
 */
export function AccuseDialog({
  open,
  forced,
  citizens,
  allCitizens,
  victims,
  motiveOptions,
  crossedMotives,
  journal,
  onSubmit,
  onClose
}: AccuseDialogProps) {
  const [job, setJob] = useState<string | null>(null);
  const [motiveId, setMotiveId] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);

  if (!open) return null;
  const motives = MOTIVE_DESCRIPTORS.filter(m => motiveOptions.includes(m.id));
  const ready = !!job && !!motiveId;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 65,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'oklch(0.12 0.01 55 / .82)',
        backdropFilter: 'blur(2px)'
      }}
      onClick={forced ? undefined : onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: journalOpen ? 1180 : 760,
          maxWidth: '100%',
          transition: 'width .2s ease',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'oklch(0.225 0.013 55)',
          border: '1px solid oklch(0.45 0.1 27)',
          borderRadius: RADIUS.panel,
          boxShadow: SHADOW.panel,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid oklch(0.38 0.07 27)',
            background: 'oklch(0.24 0.035 27)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.26em',
              color: 'oklch(0.82 0.1 30)'
            }}
          >
            ОБВИНЕНИЕ · ОДНА ПОПЫТКА
          </span>
          {forced && (
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 9.5,
                letterSpacing: '0.14em',
                padding: '3px 7px',
                borderRadius: 2,
                background: P.blood,
                color: 'oklch(0.97 0.03 30)'
              }}
            >
              ПЯТОЕ УБИЙСТВО
            </span>
          )}
        </div>

        <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'oklch(0.78 0.03 30)' }}>
            {forced
              ? 'Дело дошло до пятой жертвы. Назовите профессию убийцы и его мотив — ошибка в любом из пунктов означает поражение.'
              : 'Назовите профессию убийцы и его мотив. Ошибка в любом из пунктов означает поражение.'}
          </p>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 18 }}>
          <Label text={`ЖЕРТВЫ · ${victims.length}`} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            {victims.map((v, i) => {
              const c = allCitizens.find(x => x.id === v.citizenId);
              if (!c) return null;
              return (
                <div
                  key={v.citizenId}
                  style={{
                    flex: '1 1 150px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 9px',
                    borderRadius: 4,
                    border: '1px solid oklch(0.34 0.05 27)',
                    background: 'oklch(0.24 0.025 27)'
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      borderRadius: 9999,
                      background: P.blood,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'oklch(0.97 0.03 30)'
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'oklch(0.9 0.04 30)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {c.job}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: FONT.mono,
                        fontSize: 11,
                        color: 'oklch(0.68 0.03 40)',
                        marginTop: 1
                      }}
                    >
                      {GROUP_LABELS[c.group]} · {districtName(v.districtX, v.districtY)} · ХОД{' '}
                      {v.turnNumber}
                      {v.wasScared && (
                        <span style={{ color: 'oklch(0.78 0.1 300)' }}> · БЫЛ ЗАПУГАН</span>
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
            {victims.length === 0 && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'oklch(0.6 0.014 80)' }}>
                Убийств пока не было.
              </p>
            )}
          </div>

          <Label text="КТО УБИЙЦА" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              marginBottom: 18
            }}
          >
            {citizens.map(c => {
              const on = job === c.job;
              return (
                <button
                  key={c.id}
                  onClick={() => setJob(c.job)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 9px',
                    borderRadius: 4,
                    border: `1px solid ${on ? 'oklch(0.5 0.12 27)' : 'oklch(0.33 0.015 55)'}`,
                    background: on ? 'oklch(0.3 0.06 27)' : 'oklch(0.26 0.014 55)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      borderRadius: 9999,
                      background: P.paper,
                      border: `2px solid ${groupRing(c.group)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: FONT.display,
                      fontSize: 13,
                      fontWeight: 800,
                      color: P.paperInk
                    }}
                  >
                    {monogram(c.job)}
                  </span>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: on ? 600 : 500,
                      color: on ? 'oklch(0.93 0.05 30)' : 'oklch(0.85 0.012 80)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c.job}
                  </span>
                </button>
              );
            })}
          </div>

          <Label text={`КАКОВ МОТИВ · ОДИН ИЗ ${motives.length} НАСТОЯЩИЙ`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {motives.map(m => {
              const on = motiveId === m.id;
              const crossed = crossedMotives.includes(m.id) && !on;
              return (
                <button
                  key={m.id}
                  onClick={() => setMotiveId(m.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: `1px solid ${on ? 'oklch(0.5 0.12 27)' : 'oklch(0.33 0.015 55)'}`,
                    background: on ? 'oklch(0.3 0.06 27)' : 'oklch(0.26 0.014 55)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    opacity: crossed ? 0.4 : 1
                  }}
                >
                  <div
                    style={{
                      textDecoration: crossed ? 'line-through' : 'none',
                      fontFamily: FONT.display,
                      fontSize: 20,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      lineHeight: 1,
                      color: on ? 'oklch(0.9 0.09 30)' : 'oklch(0.88 0.012 80)'
                    }}
                  >
                    {m.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.4,
                      marginTop: 4,
                      color: on ? 'oklch(0.8 0.04 30)' : 'oklch(0.64 0.014 80)'
                    }}
                  >
                    {m.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {journalOpen && (
          <div
            style={{
              width: 420,
              flexShrink: 0,
              borderLeft: '1px solid oklch(0.3 0.015 55)',
              overflowY: 'auto',
              padding: 18,
              background: 'oklch(0.2 0.012 55)'
            }}
          >
            <Label text="ЖУРНАЛ ДОПРОСОВ" />
            {journal}
          </div>
        )}
        </div>

        <div
          style={{
            padding: 18,
            borderTop: '1px solid oklch(0.28 0.015 55)',
            display: 'flex',
            gap: 9,
            flexShrink: 0
          }}
        >
          <button
            onClick={() => setJournalOpen(v => !v)}
            style={{
              width: 150,
              height: 50,
              borderRadius: 4,
              border: `1px solid ${journalOpen ? 'oklch(0.5 0.1 76)' : 'oklch(0.36 0.015 55)'}`,
              background: journalOpen ? 'oklch(0.3 0.05 78)' : 'transparent',
              color: journalOpen ? 'oklch(0.92 0.05 82)' : 'oklch(0.72 0.014 80)',
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              cursor: 'pointer'
            }}
          >
            {journalOpen ? '← СКРЫТЬ ЖУРНАЛ' : 'ЖУРНАЛ →'}
          </button>
          {!forced && (
            <button
              onClick={onClose}
              style={{
                width: 130,
                height: 50,
                borderRadius: 4,
                border: '1px solid oklch(0.36 0.015 55)',
                background: 'transparent',
                color: 'oklch(0.72 0.014 80)',
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: '0.14em',
                cursor: 'pointer'
              }}
            >
              ОТМЕНА
            </button>
          )}
          <button
            disabled={!ready}
            onClick={() => ready && onSubmit(job!, motiveId!)}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 4,
              border: 'none',
              background: ready
                ? 'linear-gradient(180deg, oklch(0.56 0.17 27), oklch(0.46 0.16 27))'
                : 'oklch(0.3 0.02 60)',
              color: ready ? 'oklch(0.97 0.03 30)' : 'oklch(0.5 0.014 80)',
              fontFamily: FONT.display,
              fontSize: 22,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
              cursor: ready ? 'pointer' : 'not-allowed',
              boxShadow: ready ? '0 3px 0 oklch(0.34 0.12 27)' : 'none'
            }}
          >
            {ready ? 'Предъявить обвинение' : 'Выберите профессию и мотив'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 9.5,
        letterSpacing: '0.24em',
        color: P.gold,
        marginBottom: 9
      }}
    >
      {text}
    </div>
  );
}
