import { useEffect } from 'react';
import { FONT, P, SHADOW } from '@/design/tokens';
import { Rules } from './Rules';

interface RulesSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Правила во время партии. Не модалка: справка ничего не решает и закрывается
 * чем угодно — Esc, кликом мимо, крестиком. Партия за ней остаётся видимой.
 */
export function RulesSheet({ open, onClose }: RulesSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'oklch(0.12 0.01 55 / .38)' }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 56,
          width: 460,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'oklch(0.2 0.012 55)',
          borderLeft: '1px solid oklch(0.32 0.015 55)',
          boxShadow: SHADOW.panel,
          animation: 'rules-in .2s ease'
        }}
      >
        <style>{`@keyframes rules-in { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        <div
          style={{
            height: 46,
            flexShrink: 0,
            padding: '0 12px 0 15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid oklch(0.28 0.015 55)'
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.26em',
              color: 'oklch(0.62 0.014 80)'
            }}
          >
            ПРАВИЛА
          </span>
          <button
            onClick={onClose}
            title="Закрыть · Esc"
            style={{
              height: 26,
              padding: '0 11px',
              borderRadius: 3,
              border: '1px solid oklch(0.32 0.015 55)',
              background: 'transparent',
              color: P.ink,
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.12em',
              cursor: 'pointer'
            }}
          >
            ЗАКРЫТЬ
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Rules />
        </div>
      </aside>
    </>
  );
}
