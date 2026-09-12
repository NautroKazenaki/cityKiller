import { FONT, SHADOW } from '@/design/tokens';

export interface FinalRow {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'ink' | 'good' | 'bad';
}

interface FinalDialogProps {
  open: boolean;
  /** Исход дела: раскрыто детективом или ушло в висяк. Штамп ставится по делу, а не по игроку. */
  solved: boolean;
  reason: string | null;
  roomCode: string;
  turnNumber: number;
  rows: FinalRow[];
  onMenu: () => void;
}

const TONE_FG = {
  ink: 'oklch(0.24 0.02 60)',
  good: 'oklch(0.36 0.13 150)',
  bad: 'oklch(0.42 0.15 27)'
} as const;

/**
 * Финал — печать на деле, а не диалог «Победа/Поражение».
 * Бумажный документ со штампом поверх: единственный светлый объект на затемнённом столе.
 */
export function FinalDialog({
  open,
  solved,
  reason,
  roomCode,
  turnNumber,
  rows,
  onMenu
}: FinalDialogProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'oklch(0.12 0.01 55 / .86)',
        backdropFilter: 'blur(3px)'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 460,
          background: 'oklch(0.91 0.024 84)',
          borderRadius: 2,
          padding: '30px 28px',
          boxSizing: 'border-box',
          boxShadow: '0 26px 54px -16px rgba(0,0,0,.85)'
        }}
      >
        {/* штамп */}
        <div
          style={{
            position: 'absolute',
            right: -14,
            top: 26,
            transform: 'rotate(9deg)',
            border: `4px solid ${solved ? 'oklch(0.42 0.14 150)' : 'oklch(0.45 0.17 27)'}`,
            color: solved ? 'oklch(0.38 0.14 150)' : 'oklch(0.42 0.17 27)',
            fontFamily: FONT.display,
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '0.1em',
            padding: '5px 18px',
            borderRadius: 3,
            background: 'oklch(0.91 0.024 84 / .7)'
          }}
        >
          {solved ? 'РАСКРЫТО' : 'ВИСЯК'}
        </div>

        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: '0.28em',
            color: 'oklch(0.45 0.03 50)'
          }}
        >
          ДЕЛО № {roomCode} · ЗАКРЫТО НА ХОДУ {turnNumber}
        </div>

        <h3
          style={{
            margin: '12px 0 0',
            maxWidth: 300,
            fontFamily: FONT.display,
            fontSize: 52,
            fontWeight: 800,
            textTransform: 'uppercase',
            lineHeight: 0.9,
            color: 'oklch(0.24 0.02 60)'
          }}
        >
          {solved ? 'Дело раскрыто' : 'Убийца ушёл'}
        </h3>

        <div style={{ height: 1, background: 'oklch(0.5 0.03 55 / .4)', margin: '20px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span
                style={{
                  width: 118,
                  flexShrink: 0,
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  letterSpacing: '0.18em',
                  color: 'oklch(0.48 0.03 50)'
                }}
              >
                {r.label}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 15,
                  fontWeight: r.strong ? 600 : 400,
                  color: TONE_FG[r.tone ?? 'ink'],
                  lineHeight: 1.4
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>

        {reason && (
          <>
            <div style={{ height: 1, background: 'oklch(0.5 0.03 55 / .4)', margin: '20px 0' }} />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'oklch(0.34 0.02 55)' }}>
              {reason}
            </p>
          </>
        )}

        <div style={{ height: 1, background: 'oklch(0.5 0.03 55 / .4)', margin: '20px 0' }} />

        <button
          onClick={onMenu}
          style={{
            width: '100%',
            height: 46,
            borderRadius: 3,
            border: 'none',
            background: 'oklch(0.28 0.02 60)',
            color: 'oklch(0.93 0.02 85)',
            fontFamily: FONT.display,
            fontSize: 18,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            boxShadow: SHADOW.card
          }}
        >
          Новое дело
        </button>

        {/* зернистость бумаги */}
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
    </div>
  );
}
