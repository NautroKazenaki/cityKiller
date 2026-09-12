import type { Citizen, CitizenGroup } from '@citykiller/shared';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';
import { chitRing, monogram } from '@/design/city';
import { GROUP_LABELS, HEIGHT_SHORT } from '@/lib/labels';
import { Icon } from '../sheet/Icon';

export interface NightStep {
  n: string;
  text: string;
  state: string;
  done: boolean;
}

interface KillerFolderProps {
  killerCitizen: Citizen;
  scared: boolean;
  motiveTitle: string;
  motiveDescription: string;
  allyGroup: CitizenGroup;
  /** Бейдж справа в шапке: «НОЧЬ 3», «ДЕНЬ 3» и т.п. */
  phaseBadge: string;
  stepsTitle: string;
  steps: NightStep[];
  children?: React.ReactNode;
}

/** Папка убийцы: личность, мотив, группа-помощник и ночные дела. Кровавый акцент вместо золотого. */
export function KillerFolder({
  killerCitizen,
  scared,
  motiveTitle,
  motiveDescription,
  allyGroup,
  phaseBadge,
  stepsTitle,
  steps,
  children
}: KillerFolderProps) {
  return (
    <div
      style={{
        background: 'oklch(0.225 0.013 55)',
        border: '1px solid oklch(0.36 0.06 27)',
        borderRadius: RADIUS.panel,
        overflow: 'hidden',
        boxShadow: SHADOW.panel,
        flexShrink: 0
      }}
    >
      <div
        style={{
          padding: '11px 15px',
          borderBottom: '1px solid oklch(0.32 0.04 27)',
          background: 'oklch(0.24 0.035 27)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: '0.24em',
            color: 'oklch(0.82 0.1 30)'
          }}
        >
          ВАШЕ ДЕЛО · УБИЙЦА
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: '0.14em',
            padding: '3px 7px',
            borderRadius: 2,
            background: 'oklch(0.34 0.07 300)',
            color: 'oklch(0.88 0.07 300)'
          }}
        >
          {phaseBadge}
        </span>
      </div>

      {/* личность */}
      <div
        style={{
          padding: 15,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          borderBottom: '1px solid oklch(0.28 0.015 55)'
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: 9999,
            background: P.paper,
            border: `3.5px solid ${chitRing(killerCitizen.color)}`,
            boxShadow: `0 0 0 2px ${P.gold}, 0 3px 0 rgba(0,0,0,.3)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span
            style={{ fontFamily: FONT.display, fontSize: 26, fontWeight: 800, color: P.paperInk }}
          >
            {monogram(killerCitizen.job)}
          </span>
          {scared && (
            <span
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: 9999,
                background:
                  'repeating-linear-gradient(135deg, oklch(0.58 0.16 27 / .32) 0 2px, transparent 2px 5px)'
              }}
            />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: P.ink }}>{killerCitizen.job}</div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10.5,
              color: 'oklch(0.64 0.014 80)',
              marginTop: 3
            }}
          >
            {killerCitizen.sex === 'male' ? '♂' : '♀'} {killerCitizen.age} · {killerCitizen.size} ·{' '}
            {HEIGHT_SHORT[killerCitizen.height].toUpperCase()} ·{' '}
            {GROUP_LABELS[killerCitizen.group].toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: '0.16em',
              color: 'oklch(0.8 0.11 80)',
              marginTop: 5
            }}
          >
            ЭТО ВЫ{scared ? ' · ЗАПУГАНЫ' : ''}
          </div>
        </div>
      </div>

      <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* мотив */}
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: '0.22em',
              color: 'oklch(0.6 0.014 80)',
              marginBottom: 6
            }}
          >
            МОТИВ · ЗНАЕТЕ ТОЛЬКО ВЫ
          </div>
          <div
            style={{
              padding: '11px 13px',
              borderRadius: 4,
              background: 'oklch(0.26 0.04 27 / .55)',
              border: '1px solid oklch(0.42 0.09 27)'
            }}
          >
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 24,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'oklch(0.85 0.11 30)',
                lineHeight: 1
              }}
            >
              {motiveTitle}
            </div>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'oklch(0.78 0.03 30)' }}>
              {motiveDescription}
            </p>
          </div>
        </div>

        {/* группа-помощник */}
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: '0.22em',
              color: 'oklch(0.6 0.014 80)',
              marginBottom: 6
            }}
          >
            ГРУППА-ПОМОЩНИК · ЗА НЕЁ МОЖНО ЛГАТЬ
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 4,
              background: 'oklch(0.26 0.014 55)',
              border: '1px solid oklch(0.36 0.015 55)'
            }}
          >
            <Icon name="police" color={P.gold} size={16} width={2} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'oklch(0.9 0.012 80)' }}>
              {GROUP_LABELS[allyGroup]}
            </span>
          </div>
        </div>

        {/* ночные дела */}
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: '0.22em',
              color: P.gold,
              marginBottom: 8
            }}
          >
            {stepsTitle}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {steps.map(s => (
              <div
                key={s.n}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 12px',
                  borderRadius: 4,
                  background: s.done ? 'oklch(0.26 0.04 27 / .45)' : 'oklch(0.26 0.014 55)',
                  border: `1px solid ${s.done ? 'oklch(0.42 0.09 27)' : 'oklch(0.33 0.015 55)'}`
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 9999,
                    background: s.done ? P.blood : 'oklch(0.32 0.016 55)',
                    color: s.done ? 'oklch(0.97 0.03 30)' : 'oklch(0.72 0.014 80)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    fontWeight: 600,
                    flexShrink: 0
                  }}
                >
                  {s.n}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: s.done ? 'oklch(0.9 0.03 30)' : P.ink }}>
                  {s.text}
                </span>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    color: s.done ? 'oklch(0.8 0.1 30)' : 'oklch(0.58 0.014 80)'
                  }}
                >
                  {s.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

/** Главная кнопка убийцы: кровавая, не золотая */
export function KillerButton({
  label,
  onClick,
  disabled
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 50,
        borderRadius: 4,
        border: 'none',
        background: disabled
          ? 'oklch(0.3 0.02 60)'
          : 'linear-gradient(180deg, oklch(0.56 0.17 27), oklch(0.46 0.16 27))',
        color: disabled ? 'oklch(0.5 0.014 80)' : 'oklch(0.97 0.03 30)',
        fontFamily: FONT.display,
        fontSize: 22,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled
          ? 'none'
          : '0 3px 0 oklch(0.34 0.12 27), 0 12px 22px -8px oklch(0.4 0.14 27 / .6)'
      }}
    >
      {label}
    </button>
  );
}
