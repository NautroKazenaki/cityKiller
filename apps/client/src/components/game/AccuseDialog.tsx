import { useState } from 'react';
import type { Citizen } from '@citykiller/shared';
import { MOTIVE_DESCRIPTORS } from '@citykiller/shared';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';
import { chitRing, monogram } from '@/design/city';

interface AccuseDialogProps {
  open: boolean;
  forced: boolean;
  citizens: Citizen[];
  /** id 6 мотивов-кандидатов, среди которых один настоящий */
  motiveOptions: string[];
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
  motiveOptions,
  onSubmit,
  onClose
}: AccuseDialogProps) {
  const [job, setJob] = useState<string | null>(null);
  const [motiveId, setMotiveId] = useState<string | null>(null);

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
          width: 760,
          maxWidth: '100%',
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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
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
                      border: `2px solid ${chitRing(c.color)}`,
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
                    textAlign: 'left'
                  }}
                >
                  <div
                    style={{
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

        <div
          style={{
            padding: 18,
            borderTop: '1px solid oklch(0.28 0.015 55)',
            display: 'flex',
            gap: 9,
            flexShrink: 0
          }}
        >
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
