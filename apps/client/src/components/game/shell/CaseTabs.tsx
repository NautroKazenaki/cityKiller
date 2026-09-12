import { FONT, P } from '@/design/tokens';

export interface CaseTab {
  id: string;
  label: string;
}

interface CaseTabsProps {
  tabs: CaseTab[];
  active: string;
  onSelect: (id: string) => void;
}

/** Табы папки дела. Активный сливается с панелью под ним. */
export function CaseTabs({ tabs, active, onSelect }: CaseTabsProps) {
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              flex: 1,
              height: 34,
              borderRadius: '4px 4px 0 0',
              borderTop: `1px solid ${on ? 'oklch(0.3 0.015 55)' : 'oklch(0.27 0.014 55)'}`,
              borderLeft: `1px solid ${on ? 'oklch(0.3 0.015 55)' : 'oklch(0.27 0.014 55)'}`,
              borderRight: `1px solid ${on ? 'oklch(0.3 0.015 55)' : 'oklch(0.27 0.014 55)'}`,
              borderBottom: 'none',
              background: on ? 'oklch(0.225 0.013 55)' : 'oklch(0.185 0.011 55)',
              color: on ? P.gold : 'oklch(0.58 0.014 80)',
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.16em',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
