import type { CSSProperties, ReactNode } from 'react';
import { FONT, RADIUS, SHADOW } from '@/design/tokens';

interface PanelProps {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

/** Панель «стола»: тёмная матовая, радиус 5, две тени — край картона и опорная. */
export function Panel({ title, aside, children, style, bodyStyle }: PanelProps) {
  return (
    <div
      style={{
        background: 'oklch(0.225 0.013 55)',
        border: '1px solid oklch(0.3 0.015 55)',
        borderRadius: RADIUS.panel,
        boxShadow: SHADOW.panel,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...style
      }}
    >
      {title && (
        <div
          style={{
            padding: '9px 13px',
            borderBottom: '1px solid oklch(0.28 0.015 55)',
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
              color: 'oklch(0.6 0.014 80)'
            }}
          >
            {title}
          </span>
          {aside}
        </div>
      )}
      <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', ...bodyStyle }}>
        {children}
      </div>
    </div>
  );
}
