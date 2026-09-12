import type { ReactNode } from 'react';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';

/** Экран-заглушка на тёмном столе: лобби, ошибки подключения. */
export function CenterCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'linear-gradient(180deg, oklch(0.2 0.012 55), oklch(0.165 0.011 55))',
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
          top: -160,
          width: 1100,
          height: 620,
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, oklch(0.78 0.07 78 / .17), transparent 70%)',
          pointerEvents: 'none',
          animation: 'ck-lamp 6s ease-in-out infinite'
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 420,
          maxWidth: '100%',
          textAlign: 'center',
          background: 'oklch(0.225 0.013 55)',
          border: '1px solid oklch(0.3 0.015 55)',
          borderRadius: RADIUS.panel,
          boxShadow: SHADOW.panel,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '13px 15px',
            borderBottom: '1px solid oklch(0.28 0.015 55)',
            fontFamily: FONT.display,
            fontSize: 26,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: P.ink
          }}
        >
          {title}
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </div>
    </div>
  );
}

export function NoirButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
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
      {label}
    </button>
  );
}
