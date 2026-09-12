import type { PlayerRole } from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';

interface LobbyProps {
  roomCode: string;
  myRole: PlayerRole;
  myName: string;
  opponentRole: PlayerRole;
  opponentName: string | null;
}

const ROLE_LOOK: Record<PlayerRole, { mono: string; label: string; accent: string; avBg: string }> = {
  detective: {
    mono: 'Д',
    label: 'ДЕТЕКТИВ',
    accent: 'oklch(0.62 0.12 250)',
    avBg: 'oklch(0.22 0.03 250)'
  },
  killer: {
    mono: 'У',
    label: 'УБИЙЦА',
    accent: 'oklch(0.58 0.16 27)',
    avBg: 'oklch(0.22 0.04 27)'
  }
};

/** Лобби — карточка вызова с кодом дела на бумаге. */
export function Lobby({ roomCode, myRole, myName, opponentRole, opponentName }: LobbyProps) {
  const me = ROLE_LOOK[myRole];
  const them = ROLE_LOOK[opponentRole];

  const slots = [
    {
      key: 'me',
      mono: me.mono,
      name: myName,
      role: me.label,
      state: 'ГОТОВ',
      accent: me.accent,
      avBg: me.avBg,
      bg: 'oklch(0.24 0.03 250 / .5)',
      bd: 'oklch(0.42 0.08 250)',
      bdStyle: 'solid',
      nameFg: P.ink,
      roleFg: 'oklch(0.78 0.05 250)',
      stateFg: 'oklch(0.7 0.12 150)'
    },
    {
      key: 'them',
      mono: opponentName ? them.mono : '?',
      name: opponentName ?? 'Ожидание',
      role: them.label,
      state: opponentName ? 'ПОДКЛЮЧАЕТСЯ' : 'ПУСТО',
      accent: opponentName ? them.accent : 'oklch(0.45 0.014 80)',
      avBg: opponentName ? them.avBg : 'transparent',
      bg: 'transparent',
      bd: 'oklch(0.32 0.016 55)',
      bdStyle: opponentName ? 'solid' : 'dashed',
      nameFg: opponentName ? P.ink : 'oklch(0.58 0.014 80)',
      roleFg: 'oklch(0.48 0.014 80)',
      stateFg: 'oklch(0.5 0.014 80)'
    }
  ];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        background: 'linear-gradient(180deg, oklch(0.2 0.012 55), oklch(0.155 0.011 55))',
        fontFamily: FONT.sans,
        color: P.ink,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -140,
          width: 620,
          height: 460,
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, oklch(0.78 0.07 78 / .16), transparent 70%)',
          animation: 'ck-lamp 6s ease-in-out infinite',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'relative',
          width: 512,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 26
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: '0.34em',
            color: 'oklch(0.58 0.014 80)'
          }}
        >
          ДЕЛО ОТКРЫТО · ЖДЁМ НАПАРНИКА
        </div>

        {/* бумажная карточка с кодом */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            background: 'oklch(0.91 0.024 84)',
            borderRadius: 2,
            padding: '26px 22px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 40px -14px rgba(0,0,0,.8)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: '0.28em',
              color: 'oklch(0.45 0.03 50)'
            }}
          >
            КОД ДЕЛА
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: '0.1em',
              lineHeight: 1,
              color: 'oklch(0.26 0.02 60)',
              marginTop: 8,
              userSelect: 'all'
            }}
          >
            {roomCode}
          </div>
          <div style={{ height: 1, background: 'oklch(0.5 0.03 55 / .4)', margin: '16px 0' }} />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'oklch(0.4 0.025 55)' }}>
            Передайте код второму игроку. Партия начнётся автоматически.
          </p>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.5,
              backgroundImage: 'radial-gradient(oklch(0.5 0.04 60 / .09) 0.5px, transparent 0.5px)',
              backgroundSize: '3px 3px'
            }}
          />
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {slots.map(s => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '13px 15px',
                borderRadius: 5,
                background: s.bg,
                border: `1px ${s.bdStyle} ${s.bd}`
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: 9999,
                  background: s.avBg,
                  border: `2px ${s.bdStyle} ${s.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT.display,
                  fontSize: 19,
                  fontWeight: 800,
                  color: s.accent
                }}
              >
                {s.mono}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: s.nameFg }}>{s.name}</div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: s.roleFg,
                    marginTop: 3
                  }}
                >
                  {s.role}
                </div>
              </div>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  letterSpacing: '0.12em',
                  color: s.stateFg
                }}
              >
                {s.state}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
