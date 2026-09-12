import { FONT } from '@/design/tokens';
import { Icon } from '../sheet/Icon';
import type { IconName } from '@/design/tokens';

export type ActionTone = 'primary' | 'plain' | 'police' | 'disabled';

export interface ActionSpec {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  hotkey?: string;
  tone: ActionTone;
  onClick?: () => void;
}

const TONES: Record<
  ActionTone,
  {
    bd: string;
    bg: string;
    shadow: string;
    cursor: string;
    iconFg: string;
    titleFg: string;
    descFg: string;
    keyBg: string;
    keyFg: string;
  }
> = {
  primary: {
    bd: 'oklch(0.52 0.12 78)',
    bg: 'linear-gradient(180deg, oklch(0.3 0.05 78), oklch(0.26 0.04 72))',
    shadow: '0 2px 0 oklch(0.42 0.08 72)',
    cursor: 'pointer',
    iconFg: 'oklch(0.84 0.11 80)',
    titleFg: 'oklch(0.95 0.03 82)',
    descFg: 'oklch(0.74 0.06 80)',
    keyBg: 'oklch(0.45 0.09 75)',
    keyFg: 'oklch(0.95 0.03 82)'
  },
  plain: {
    bd: 'oklch(0.36 0.015 55)',
    bg: 'oklch(0.26 0.014 55)',
    shadow: 'none',
    cursor: 'pointer',
    iconFg: 'oklch(0.8 0.012 80)',
    titleFg: 'oklch(0.92 0.012 80)',
    descFg: 'oklch(0.62 0.014 80)',
    keyBg: 'oklch(0.32 0.016 55)',
    keyFg: 'oklch(0.72 0.014 80)'
  },
  police: {
    bd: 'oklch(0.4 0.08 250)',
    bg: 'oklch(0.26 0.04 250 / .7)',
    shadow: 'none',
    cursor: 'pointer',
    iconFg: 'oklch(0.8 0.1 250)',
    titleFg: 'oklch(0.92 0.03 250)',
    descFg: 'oklch(0.68 0.05 250)',
    keyBg: 'oklch(0.34 0.06 250)',
    keyFg: 'oklch(0.88 0.05 250)'
  },
  disabled: {
    bd: 'oklch(0.26 0.014 55)',
    bg: 'transparent',
    shadow: 'none',
    cursor: 'not-allowed',
    iconFg: 'oklch(0.42 0.014 80)',
    titleFg: 'oklch(0.48 0.014 80)',
    descFg: 'oklch(0.4 0.014 80)',
    keyBg: 'transparent',
    keyFg: 'oklch(0.36 0.014 80)'
  }
};

/** Строка действия в папке дела: глиф, заголовок, причина/цена, горячая клавиша. */
export function ActionRow({ action }: { action: ActionSpec }) {
  const t = TONES[action.tone];
  const disabled = action.tone === 'disabled';
  return (
    <button
      onClick={disabled ? undefined : action.onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '10px 12px',
        borderRadius: 4,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        cursor: t.cursor,
        textAlign: 'left',
        boxShadow: t.shadow
      }}
    >
      <Icon name={action.icon} color={t.iconFg} size={18} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: t.titleFg }}>
          {action.title}
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: FONT.mono,
            fontSize: 10,
            color: t.descFg,
            marginTop: 2
          }}
        >
          {action.desc}
        </span>
      </span>
      {action.hotkey && (
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            padding: '3px 6px',
            borderRadius: 2,
            background: t.keyBg,
            color: t.keyFg,
            flexShrink: 0
          }}
        >
          {action.hotkey}
        </span>
      )}
    </button>
  );
}

/** Главные кнопки хода: золотая основная и кровавая опасная. */
export function PrimaryButton({
  label,
  onClick,
  disabled,
  width
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  width?: number | string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: width ? undefined : 1,
        width,
        height: 52,
        borderRadius: 4,
        border: 'none',
        background: disabled
          ? 'oklch(0.3 0.02 60)'
          : 'linear-gradient(180deg, oklch(0.76 0.12 78), oklch(0.66 0.12 76))',
        color: disabled ? 'oklch(0.5 0.014 80)' : 'oklch(0.2 0.05 60)',
        fontFamily: FONT.display,
        fontSize: 22,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled
          ? 'none'
          : '0 3px 0 oklch(0.5 0.1 72), 0 12px 22px -8px oklch(0.5 0.1 72 / .6)'
      }}
    >
      {label}
    </button>
  );
}

export function DangerButton({
  label,
  onClick,
  disabled,
  width = 150
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  width?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width,
        height: 52,
        borderRadius: 4,
        border: `1px solid ${disabled ? 'oklch(0.3 0.02 27)' : 'oklch(0.45 0.1 27)'}`,
        background: disabled ? 'transparent' : 'oklch(0.26 0.05 27 / .6)',
        color: disabled ? 'oklch(0.45 0.02 30)' : 'oklch(0.78 0.12 30)',
        fontFamily: FONT.display,
        fontSize: 20,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      {label}
    </button>
  );
}

/** Подсказка под списком действий */
export function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        gap: 11,
        padding: '11px 13px',
        borderRadius: 4,
        background: 'oklch(0.26 0.03 78 / .5)',
        border: '1px solid oklch(0.42 0.06 78)'
      }}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }}
        fill="none"
        stroke="oklch(0.78 0.11 78)"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v5h1" />
      </svg>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'oklch(0.86 0.04 82)' }}>
        {children}
      </p>
    </div>
  );
}
