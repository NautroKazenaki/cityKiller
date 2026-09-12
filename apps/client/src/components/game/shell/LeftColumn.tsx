import type { GameLogEntry, GamePhase, PlayerRole } from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';
import { Panel } from './Panel';

interface LeftColumnProps {
  role: PlayerRole;
  phase: GamePhase;
  turnNumber: number;
  myName: string;
  opponentName: string;
  opponentConnected: boolean;
  /** Экономика хода детектива: null для убийцы вне дня */
  movesLeft: number | null;
  abilitiesLeft: number | null;
  log: GameLogEntry[];
}

const ROLE_LOOK = {
  detective: {
    mono: 'Д',
    tag: 'ДЕТЕКТИВ',
    accent: P.police,
    avBg: 'oklch(0.22 0.03 250)',
    tagBg: 'oklch(0.3 0.05 250)',
    tagFg: 'oklch(0.88 0.05 250)'
  },
  killer: {
    mono: 'У',
    tag: 'УБИЙЦА',
    accent: P.blood,
    avBg: 'oklch(0.22 0.04 27)',
    tagBg: 'oklch(0.3 0.06 27)',
    tagFg: 'oklch(0.85 0.1 30)'
  }
} as const;

/** Чей ход сейчас по фазе */
function activeRole(phase: GamePhase): PlayerRole | null {
  if (phase === 'night') return 'killer';
  if (phase === 'setup' || phase === 'relocation' || phase === 'day' || phase === 'accusation') {
    return 'detective';
  }
  return null;
}

function statusFor(phase: GamePhase, role: PlayerRole, turn: number): string {
  const active = activeRole(phase);
  if (phase === 'finished') return 'ДЕЛО ЗАКРЫТО';
  if (phase === 'city') return 'ФАЗА ГОРОДА';
  if (active === role) {
    if (phase === 'night') return `ВАШ ХОД · НОЧЬ ${turn}`;
    if (phase === 'day') return `ВАШ ХОД · ДЕНЬ ${turn}`;
    if (phase === 'setup') return 'ВАШ ХОД · РАССТАНОВКА';
    if (phase === 'relocation') return 'ВАШ ХОД · РАССЕЛЕНИЕ';
    if (phase === 'accusation') return 'ВАШ ХОД · ОБВИНЕНИЕ';
  }
  return role === 'killer' ? 'ЖДЁТ НОЧИ' : 'ЖДЁТ ДНЯ';
}

function logAccent(entry: GameLogEntry): { accent: string; bg: string; fg: string } {
  const msg = entry.message.toLowerCase();
  if (msg.includes('убит') || msg.includes('поражение') || msg.includes('победа')) {
    return { accent: P.blood, bg: 'oklch(0.28 0.04 27 / .3)', fg: 'oklch(0.86 0.05 30)' };
  }
  if (msg.includes('жетон')) {
    return { accent: P.police, bg: 'transparent', fg: 'oklch(0.8 0.012 80)' };
  }
  if (msg.includes('запуган')) {
    return { accent: 'oklch(0.55 0.12 300)', bg: 'transparent', fg: 'oklch(0.76 0.012 80)' };
  }
  if (msg.includes('ответил') || msg.includes('спрашивает')) {
    return { accent: 'oklch(0.57 0.13 150)', bg: 'transparent', fg: 'oklch(0.8 0.012 80)' };
  }
  return { accent: 'oklch(0.32 0.016 55)', bg: 'transparent', fg: 'oklch(0.76 0.012 80)' };
}

/** Левая колонка 340px: кто играет, чей ход, сколько осталось действий, что уже произошло. */
export function LeftColumn({
  role,
  phase,
  turnNumber,
  myName,
  opponentName,
  opponentConnected,
  movesLeft,
  abilitiesLeft,
  log
}: LeftColumnProps) {
  const opponentRole: PlayerRole = role === 'detective' ? 'killer' : 'detective';
  const active = activeRole(phase);
  const entries = [...log].reverse();

  const rows = [
    { role, name: myName, you: true, connected: true },
    { role: opponentRole, name: opponentName, you: false, connected: opponentConnected }
  ];

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0
      }}
    >
      <Panel title="УЧАСТНИКИ ДЕЛА" style={{ flexShrink: 0 }}>
        {rows.map(r => {
          const look = ROLE_LOOK[r.role];
          const isActive = active === r.role;
          return (
            <div
              key={r.role}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '11px 13px',
                borderBottom: '1px solid oklch(0.26 0.014 55)',
                background: isActive ? 'oklch(0.26 0.02 60 / .5)' : 'transparent'
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: 9999,
                  background: look.avBg,
                  border: `2px solid ${look.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 19,
                    fontWeight: 800,
                    color: look.accent
                  }}
                >
                  {look.mono}
                </span>
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: -6,
                      borderRadius: 9999,
                      border: '2px solid oklch(0.72 0.12 78 / .5)',
                      animation: 'ck-turn 2.4s ease-out infinite'
                    }}
                  />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>{r.name}</span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      padding: '2px 5px',
                      borderRadius: 2,
                      background: look.tagBg,
                      color: look.tagFg
                    }}
                  >
                    {r.you ? `ВЫ · ${look.tag}` : look.tag}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    color: isActive ? P.gold : 'oklch(0.55 0.014 80)',
                    marginTop: 3
                  }}
                >
                  {statusFor(phase, r.role, turnNumber)}
                </div>
              </div>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 9999,
                  background: r.connected ? 'oklch(0.62 0.12 150)' : 'oklch(0.55 0.014 80)',
                  flexShrink: 0
                }}
              />
            </div>
          );
        })}

        {movesLeft !== null && abilitiesLeft !== null && (
          <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              { label: 'ПЕРЕМЕЩЕНИЯ', left: movesLeft },
              { label: 'ВОЗМОЖНОСТИ', left: abilitiesLeft }
            ].map(e => (
              <div
                key={e.label}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    color: 'oklch(0.66 0.014 80)'
                  }}
                >
                  {e.label}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0, 1].map(i => (
                    <span
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 9999,
                        background: i < e.left ? P.gold : 'transparent',
                        border: `1.5px solid ${i < e.left ? P.gold : 'oklch(0.38 0.018 55)'}`
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="ПОЛИЦЕЙСКАЯ СВОДКА"
        aside={
          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: 'oklch(0.5 0.014 80)' }}>
            {log.length}
          </span>
        }
        style={{ flex: 1, minHeight: 0 }}
        bodyStyle={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0' }}
      >
        {entries.map(entry => {
          const look = logAccent(entry);
          return (
            <div
              key={entry.seq}
              style={{
                display: 'flex',
                gap: 10,
                padding: '7px 13px',
                borderLeft: `2px solid ${look.accent}`,
                background: look.bg
              }}
            >
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  color: 'oklch(0.52 0.014 80)',
                  flexShrink: 0,
                  paddingTop: 1
                }}
              >
                {String(entry.turnNumber).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: look.fg }}>{entry.message}</span>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
