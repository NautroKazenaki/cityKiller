import { useState } from 'react';
import type { Citizen, QuestionAttribute, QuestionValue } from '@citykiller/shared';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';
import { groupRing, monogram } from '@/design/city';
import { ATTRIBUTE_LABELS, ATTRIBUTE_VALUES, GROUP_LABELS, questionText } from '@/lib/labels';

interface QuestionDialogProps {
  citizen: Citizen | null;
  viaDiner: boolean;
  onSubmit: (attribute: QuestionAttribute, value: QuestionValue) => void;
  onClose: () => void;
}

/**
 * Вопрос жителю. Модалка оправдана: вопрос тратит возможность и ответ уже не отменить.
 * Спрашивать можно только о характеристиках убийцы — четыре признака, значения на выбор.
 */
export function QuestionDialog({ citizen, viaDiner, onSubmit, onClose }: QuestionDialogProps) {
  const [attribute, setAttribute] = useState<QuestionAttribute>('sex');
  const [value, setValue] = useState<QuestionValue>('male');

  if (!citizen) return null;
  const attributes = Object.keys(ATTRIBUTE_LABELS) as QuestionAttribute[];

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
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: 'calc(100vw - 40px)',
          background: 'oklch(0.225 0.013 55)',
          border: '1px solid oklch(0.3 0.015 55)',
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
            ДОПРОС · ТРАТИТ ВОЗМОЖНОСТЬ
          </span>
          {viaDiner && (
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

        <div
          style={{
            padding: '15px 18px',
            display: 'flex',
            gap: 13,
            alignItems: 'center',
            borderBottom: '1px solid oklch(0.28 0.015 55)'
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
              borderRadius: 9999,
              background: P.paper,
              border: `2.5px solid ${groupRing(citizen.group)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: SHADOW.card
            }}
          >
            <span
              style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 800, color: P.paperInk }}
            >
              {monogram(citizen.job)}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: P.ink }}>{citizen.job}</div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: 'oklch(0.62 0.014 80)',
                marginTop: 2
              }}
            >
              {GROUP_LABELS[citizen.group].toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Row label="О ЧЁМ СПРОСИТЬ">
            {attributes.map(attr => (
              <Chip
                key={attr}
                label={ATTRIBUTE_LABELS[attr]}
                on={attribute === attr}
                onClick={() => {
                  setAttribute(attr);
                  setValue(ATTRIBUTE_VALUES[attr][0].value);
                }}
              />
            ))}
          </Row>

          <Row label="ЗНАЧЕНИЕ">
            {ATTRIBUTE_VALUES[attribute].map(option => (
              <Chip
                key={String(option.value)}
                label={option.label}
                on={value === option.value}
                onClick={() => setValue(option.value)}
              />
            ))}
          </Row>

          <div
            style={{
              padding: '13px 15px',
              borderRadius: 4,
              background: 'oklch(0.26 0.03 78 / .5)',
              border: '1px solid oklch(0.42 0.06 78)',
              textAlign: 'center'
            }}
          >
            <span
              style={{
                fontFamily: FONT.display,
                fontSize: 24,
                fontWeight: 700,
                color: 'oklch(0.92 0.05 82)'
              }}
            >
              «{questionText(attribute, value)}»
            </span>
          </div>

          <div style={{ display: 'flex', gap: 9 }}>
            <button
              onClick={onClose}
              style={{
                width: 130,
                height: 46,
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
            <button
              onClick={() => onSubmit(attribute, value)}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 4,
                border: 'none',
                background: 'linear-gradient(180deg, oklch(0.76 0.12 78), oklch(0.66 0.12 76))',
                color: 'oklch(0.2 0.05 60)',
                fontFamily: FONT.display,
                fontSize: 19,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                cursor: 'pointer',
                boxShadow: '0 3px 0 oklch(0.5 0.1 72)'
              }}
            >
              Задать вопрос
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 9.5,
          letterSpacing: '0.22em',
          color: 'oklch(0.6 0.014 80)',
          marginBottom: 7
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 34,
        padding: '0 13px',
        borderRadius: 3,
        border: `1px solid ${on ? 'oklch(0.52 0.12 78)' : 'oklch(0.36 0.015 55)'}`,
        background: on ? 'oklch(0.3 0.05 78)' : 'oklch(0.26 0.014 55)',
        color: on ? 'oklch(0.93 0.05 82)' : 'oklch(0.8 0.012 80)',
        fontSize: 13,
        fontWeight: on ? 600 : 500,
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
}
