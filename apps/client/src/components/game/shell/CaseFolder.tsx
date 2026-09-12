import type { Citizen, CitizenPosition } from '@citykiller/shared';
import { MAX_CITIZENS_PER_DISTRICT } from '@citykiller/shared';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';
import { chitRing, districtTitle, monogram } from '@/design/city';
import { GROUP_LABELS, HEIGHT_SHORT, districtName } from '@/lib/labels';
import { ActionRow, type ActionSpec } from './ActionRow';

export interface CitizenState {
  citizen: Citizen;
  position: CitizenPosition;
  /** Подпись состояния справа в строке жителя */
  state: string;
  tone: 'ok' | 'danger' | 'quiet';
  onClick?: () => void;
}

interface CaseFolderProps {
  district: { x: number; y: number } | null;
  /** Бейджи рядом с названием района */
  badges: Array<{ label: string; tone: 'plain' | 'police' | 'blood' }>;
  citizens: CitizenState[];
  actionsTitle: string;
  actions: ActionSpec[];
  children?: React.ReactNode;
}

const STATE_TONES = {
  ok: { bg: 'oklch(0.3 0.06 150)', fg: 'oklch(0.85 0.1 150)', rowBd: 'oklch(0.36 0.05 150)' },
  danger: { bg: 'oklch(0.3 0.06 27)', fg: 'oklch(0.85 0.1 30)', rowBd: 'oklch(0.3 0.015 55)' },
  quiet: { bg: 'oklch(0.28 0.015 55)', fg: 'oklch(0.72 0.014 80)', rowBd: 'oklch(0.3 0.015 55)' }
} as const;

const BADGE_TONES = {
  plain: { bg: 'oklch(0.28 0.015 55)', fg: 'oklch(0.72 0.014 80)' },
  police: { bg: 'oklch(0.3 0.05 250)', fg: 'oklch(0.88 0.05 250)' },
  blood: { bg: 'oklch(0.3 0.06 27)', fg: 'oklch(0.85 0.1 30)' }
} as const;

/**
 * Папка дела: контекст выбранного района и список доступных действий.
 * Ответ на «что я могу сделать прямо сейчас» всегда в одном месте.
 */
export function CaseFolder({
  district,
  badges,
  citizens,
  actionsTitle,
  actions,
  children
}: CaseFolderProps) {
  return (
    <div
      // смена района — кросс-фейд содержимого панели, 180 мс
      key={district ? `${district.x},${district.y}` : 'none'}
      style={{
        background: 'oklch(0.225 0.013 55)',
        border: '1px solid oklch(0.3 0.015 55)',
        borderRadius: `0 0 ${RADIUS.panel} ${RADIUS.panel}`,
        boxShadow: SHADOW.panel,
        overflow: 'hidden',
        flexShrink: 0,
        animation: 'ck-fade .18s ease-out'
      }}
    >
      {/* заголовок района */}
      <div style={{ padding: '13px 15px', borderBottom: '1px solid oklch(0.28 0.015 55)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 9.5,
                letterSpacing: '0.22em',
                color: 'oklch(0.6 0.014 80)'
              }}
            >
              {district ? `РАЙОН ${districtName(district.x, district.y)} · ВЫБРАН` : 'РАЙОН НЕ ВЫБРАН'}
            </div>
            <h3
              style={{
                margin: '5px 0 0',
                fontFamily: FONT.display,
                fontSize: 32,
                fontWeight: 700,
                textTransform: 'uppercase',
                lineHeight: 1,
                color: P.ink
              }}
            >
              {district ? districtTitle(district.x, district.y) : 'Кликните по карте'}
            </h3>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 4,
              flexShrink: 0
            }}
          >
            {badges.map(b => {
              const tone = BADGE_TONES[b.tone];
              return (
                <span
                  key={b.label}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    padding: '3px 7px',
                    borderRadius: 2,
                    background: tone.bg,
                    color: tone.fg,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {b.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* жители района */}
      {citizens.length > 0 && (
        <div
          style={{
            padding: '11px 15px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderBottom: '1px solid oklch(0.28 0.015 55)'
          }}
        >
          {citizens.map(c => {
            const tone = STATE_TONES[c.tone];
            return (
              <div
                key={c.citizen.id}
                onClick={c.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '8px 10px',
                  borderRadius: 4,
                  background: c.tone === 'ok' ? 'oklch(0.26 0.02 60 / .45)' : 'transparent',
                  border: `1px solid ${tone.rowBd}`,
                  cursor: c.onClick ? 'pointer' : 'default'
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 9999,
                    background: P.paper,
                    border: `2.5px solid ${chitRing(c.citizen.color)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.display,
                      fontSize: 16,
                      fontWeight: 800,
                      color: P.paperInk
                    }}
                  >
                    {monogram(c.citizen.job)}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{c.citizen.job}</div>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      color: 'oklch(0.62 0.014 80)',
                      marginTop: 2
                    }}
                  >
                    {c.citizen.sex === 'male' ? '♂' : '♀'} {c.citizen.age} · {c.citizen.size} ·{' '}
                    {HEIGHT_SHORT[c.citizen.height]} · {GROUP_LABELS[c.citizen.group].toUpperCase()}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    padding: '3px 6px',
                    borderRadius: 2,
                    background: tone.bg,
                    color: tone.fg,
                    flexShrink: 0
                  }}
                >
                  {c.state}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* доступные действия */}
      <div style={{ padding: '12px 15px 15px' }}>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: '0.24em',
            color: P.gold,
            marginBottom: 9
          }}
        >
          {actionsTitle}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {actions.map(a => (
            <ActionRow key={a.id} action={a} />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function occupancyBadge(count: number): { label: string; tone: 'plain' } {
  return { label: `ЖИТЕЛЕЙ ${count}/${MAX_CITIZENS_PER_DISTRICT}`, tone: 'plain' };
}
