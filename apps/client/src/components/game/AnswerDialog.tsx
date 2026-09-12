import type { Citizen, PendingQuestion } from '@citykiller/shared';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';
import { groupRing, monogram } from '@/design/city';
import { GROUP_LABELS, HEIGHT_SHORT } from '@/lib/labels';

interface AnswerDialogProps {
  question: PendingQuestion | null;
  citizen: Citizen | null;
  /** Спрашивают самого убийцу (а не помощника) */
  isSelf: boolean;
  text: string;
  onAnswer: (answer: boolean) => void;
}

/**
 * Ответ убийцы на допрос. Модалка оправдана: ответ необратим и меняет допросный лист детектива.
 * За обычного жителя движок заставит ответить честно, за себя и группу-помощника — выбор игрока.
 */
export function AnswerDialog({ question, citizen, isSelf, text, onAnswer }: AnswerDialogProps) {
  if (!question || !citizen) return null;
  const mayLie = !question.mustBeHonest;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'oklch(0.12 0.01 55 / .78)',
        backdropFilter: 'blur(2px)'
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: 'calc(100vw - 40px)',
          background: 'oklch(0.225 0.013 55)',
          border: `1px solid ${mayLie ? 'oklch(0.42 0.09 300)' : 'oklch(0.3 0.015 55)'}`,
          borderRadius: RADIUS.panel,
          boxShadow: SHADOW.panel,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '11px 15px',
            borderBottom: '1px solid oklch(0.28 0.015 55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.24em',
              color: 'oklch(0.6 0.014 80)'
            }}
          >
            ДОПРОС · ОТВЕТ НЕОБРАТИМ
          </span>
          {question.viaDiner && (
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                letterSpacing: '0.14em',
                padding: '3px 7px',
                borderRadius: 2,
                background: 'oklch(0.28 0.015 55)',
                color: 'oklch(0.72 0.014 80)'
              }}
            >
              ЧЕРЕЗ ЗАКУСОЧНУЮ
            </span>
          )}
        </div>

        <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: 9999,
              background: P.paper,
              border: `3px solid ${groupRing(citizen.group)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: SHADOW.card
            }}
          >
            <span
              style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 800, color: P.paperInk }}
            >
              {monogram(citizen.job)}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: P.ink }}>{citizen.job}</div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: 'oklch(0.62 0.014 80)',
                marginTop: 3
              }}
            >
              {citizen.sex === 'male' ? '♂' : '♀'} {citizen.age} · {citizen.size} ·{' '}
              {HEIGHT_SHORT[citizen.height].toUpperCase()} · {GROUP_LABELS[citizen.group].toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 18px 6px' }}>
          <p
            style={{
              margin: 0,
              fontFamily: FONT.display,
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.1,
              color: P.ink
            }}
          >
            «{text}»
          </p>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mayLie ? (
            <>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 4,
                  background: 'oklch(0.28 0.05 300 / .45)',
                  border: '1px solid oklch(0.45 0.09 300)'
                }}
              >
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: '0.2em',
                    color: 'oklch(0.85 0.09 300)'
                  }}
                >
                  {isSelf ? 'ЭТО ВЫ · МОЖНО СОЛГАТЬ' : 'ГРУППА-ПОМОЩНИК · МОЖНО СОЛГАТЬ'}
                </div>
                <div style={{ fontSize: 12.5, color: 'oklch(0.86 0.03 300)', marginTop: 4 }}>
                  Правдивый ответ: «{question.truth ? 'Да' : 'Нет'}»
                </div>
              </div>
              <div style={{ display: 'flex', gap: 9 }}>
                <AnswerButton label="Ответить «Да»" tone="yes" onClick={() => onAnswer(true)} />
                <AnswerButton label="Ответить «Нет»" tone="no" onClick={() => onAnswer(false)} />
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'oklch(0.72 0.014 80)' }}>
                Этот житель не ваш персонаж и не из группы-помощника — по правилам вы обязаны
                ответить честно.
              </p>
              <AnswerButton
                label={`Ответить честно: «${question.truth ? 'Да' : 'Нет'}»`}
                tone="honest"
                onClick={() => onAnswer(question.truth)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AnswerButton({
  label,
  tone,
  onClick
}: {
  label: string;
  tone: 'yes' | 'no' | 'honest';
  onClick: () => void;
}) {
  const look =
    tone === 'honest'
      ? {
          bg: 'linear-gradient(180deg, oklch(0.76 0.12 78), oklch(0.66 0.12 76))',
          fg: 'oklch(0.2 0.05 60)',
          bd: 'none',
          shadow: '0 3px 0 oklch(0.5 0.1 72)'
        }
      : tone === 'yes'
        ? {
            bg: 'oklch(0.32 0.07 150)',
            fg: 'oklch(0.9 0.1 150)',
            bd: '1px solid oklch(0.45 0.1 150)',
            shadow: 'none'
          }
        : {
            bg: 'oklch(0.28 0.015 55)',
            fg: 'oklch(0.88 0.012 80)',
            bd: '1px solid oklch(0.4 0.015 55)',
            shadow: 'none'
          };

  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 46,
        borderRadius: 4,
        border: look.bd,
        background: look.bg,
        color: look.fg,
        fontFamily: FONT.display,
        fontSize: 19,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        cursor: 'pointer',
        boxShadow: look.shadow
      }}
    >
      {label}
    </button>
  );
}
