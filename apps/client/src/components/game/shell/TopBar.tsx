import type { GamePhase } from '@citykiller/shared';
import { KILLS_TO_WIN } from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';

const PHASES: Array<{ key: GamePhase; label: string }> = [
  { key: 'setup', label: 'РАССТАНОВКА' },
  { key: 'night', label: 'НОЧЬ' },
  { key: 'relocation', label: 'МЕСТО ПРЕСТ.' },
  { key: 'day', label: 'ДЕНЬ' },
  { key: 'city', label: 'ГОРОД' },
  { key: 'accusation', label: 'ОБВИНЕНИЕ' }
];

const BAR_BUTTON: React.CSSProperties = {
  height: 30,
  padding: '0 13px',
  borderRadius: 3,
  border: '1px solid oklch(0.3 0.015 55)',
  background: 'transparent',
  color: 'oklch(0.72 0.014 80)',
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: '0.14em',
  cursor: 'pointer'
};

interface TopBarProps {
  roomCode: string;
  phase: GamePhase;
  turnNumber: number;
  killsCount: number;
  onMenu: () => void;
  onRules: () => void;
  /** Признаки на всех жетонах: включено ли сейчас и переключатель */
  traitsOn?: boolean;
  onToggleTraits?: () => void;
}

/** Фазовая лента вместо бейджа: игрок видит весь круг хода и текущую позицию в нём. */
export function TopBar({
  roomCode,
  phase,
  turnNumber,
  killsCount,
  onMenu,
  onRules,
  traitsOn = false,
  onToggleTraits
}: TopBarProps) {
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 18,
        borderBottom: '1px solid oklch(0.29 0.015 55)',
        background: 'oklch(0.175 0.011 55)',
        position: 'relative',
        zIndex: 20
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontFamily: FONT.display,
            fontSize: 24,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: P.gold
          }}
        >
          City Killer
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'oklch(0.58 0.014 80)'
          }}
        >
          ДЕЛО № {roomCode}
        </span>
      </div>

      <div style={{ width: 1, height: 24, background: 'oklch(0.29 0.015 55)' }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'oklch(0.145 0.01 55)',
          border: '1px solid oklch(0.28 0.015 55)',
          borderRadius: 4,
          padding: 3
        }}
      >
        {PHASES.map(p => {
          const active = p.key === phase || (phase === 'finished' && p.key === 'accusation');
          return (
            <div
              key={p.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '4px 11px',
                borderRadius: 2,
                background: active ? P.gold : 'transparent',
                color: active ? 'oklch(0.2 0.05 60)' : 'oklch(0.44 0.014 80)',
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: active ? 600 : 400
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: active ? 'oklch(0.3 0.06 60)' : 'oklch(0.34 0.016 55)'
                }}
              />
              {p.label}
            </div>
          );
        })}
      </div>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          color: 'oklch(0.66 0.014 80)',
          letterSpacing: '0.1em'
        }}
      >
        ХОД {turnNumber}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: '0.16em',
            color: 'oklch(0.58 0.014 80)'
          }}
        >
          ЖЕРТВ
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: KILLS_TO_WIN }, (_, i) => (
            <span
              key={i}
              style={{
                width: 11,
                height: 11,
                borderRadius: 2,
                background: i < killsCount ? P.blood : 'transparent',
                border: `1px solid ${i < killsCount ? P.blood : 'oklch(0.38 0.018 55)'}`
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: P.blood, fontWeight: 600 }}>
          {killsCount} / {KILLS_TO_WIN}
        </span>
      </div>

      <div style={{ width: 1, height: 24, background: 'oklch(0.29 0.015 55)' }} />

      <div style={{ display: 'flex', gap: 6 }}>
        {onToggleTraits && (
          <button
            onClick={onToggleTraits}
            title="Признаки всех жителей на карте. Удерживайте Alt — или нажмите, чтобы закрепить"
            style={{
              ...BAR_BUTTON,
              border: `1px solid ${traitsOn ? 'oklch(0.5 0.1 76)' : 'oklch(0.3 0.015 55)'}`,
              background: traitsOn ? 'oklch(0.3 0.05 78)' : 'transparent',
              color: traitsOn ? 'oklch(0.92 0.05 82)' : 'oklch(0.72 0.014 80)'
            }}
          >
            ПРИЗНАКИ · ALT
          </button>
        )}
        <button onClick={onRules} title="Правила · F1" style={BAR_BUTTON}>
          ПРАВИЛА
        </button>
        <button onClick={onMenu} style={BAR_BUTTON}>
          МЕНЮ
        </button>
      </div>
    </header>
  );
}
