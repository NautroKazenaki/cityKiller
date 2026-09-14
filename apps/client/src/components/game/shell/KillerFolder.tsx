import type { Citizen, CitizenGroup } from '@citykiller/shared';
import { FONT, P, RADIUS, SHADOW } from '@/design/tokens';
import { groupRing, monogram } from '@/design/city';
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
  /** Все кандидаты, среди которых детектив ищет настоящий мотив */
  motiveCandidates: Array<{ id: string; title: string; description: string; mine: boolean }>;
  allyGroup: CitizenGroup;
  /** Пока помощник не выбран — три варианта вместо готовой группы */
  allyChoice?: {
    options: Array<{ group: CitizenGroup; members: Citizen[] }>;
    onChoose: (group: CitizenGroup) => void;
  } | null;
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
  motiveCandidates,
  allyGroup,
  allyChoice,
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
            border: `3.5px solid ${groupRing(killerCitizen.group)}`,
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

        {/* Версии детектива. Убийце это нужно не меньше, чем детективу: зная,
            среди чего его ищут, он выбирает убийства, не вычёркивающие мотивы */}
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
            ВЕРСИИ ДЕТЕКТИВА · СРЕДИ НИХ ИЩУТ ВАС
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {motiveCandidates.map(m => (
              <div
                key={m.id}
                title={m.description}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  padding: '6px 9px',
                  borderRadius: 3,
                  border: `1px solid ${m.mine ? 'oklch(0.42 0.09 27)' : 'oklch(0.3 0.014 55)'}`,
                  background: m.mine ? 'oklch(0.26 0.04 27 / .45)' : 'oklch(0.23 0.012 55)'
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 15,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    flexShrink: 0,
                    color: m.mine ? 'oklch(0.85 0.11 30)' : 'oklch(0.7 0.012 80)'
                  }}
                >
                  {m.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1.35,
                    minWidth: 0,
                    color: m.mine ? 'oklch(0.76 0.04 30)' : 'oklch(0.55 0.012 80)'
                  }}
                >
                  {m.mine ? 'ваш мотив' : m.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* группа-помощник */}
        {allyChoice ? (
          <div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 9.5,
                letterSpacing: '0.22em',
                color: P.gold,
                marginBottom: 4
              }}
            >
              ВЫБЕРИТЕ ГРУППУ-ПОМОЩНИКА · ОДНУ ИЗ ТРЁХ
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 11.5, lineHeight: 1.45, color: 'oklch(0.66 0.014 80)' }}>
              За помощников можно лгать на допросах. Детектив не узнает ни ваш выбор, ни варианты.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allyChoice.options.map(o => (
                <button
                  key={o.group}
                  onClick={() => allyChoice.onChoose(o.group)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '9px 12px',
                    borderRadius: 4,
                    border: '1px solid oklch(0.42 0.07 27)',
                    background: 'oklch(0.25 0.025 27 / .6)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 9999,
                        background: groupRing(o.group),
                        flexShrink: 0
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'oklch(0.92 0.02 60)' }}>
                      {GROUP_LABELS[o.group]}
                    </span>
                    <span
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        letterSpacing: '0.1em',
                        color: 'oklch(0.78 0.08 30)'
                      }}
                    >
                      {o.members.length} ЧЕЛ.
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, lineHeight: 1.4, color: 'oklch(0.66 0.014 80)' }}>
                    {o.members.length > 0 ? o.members.map(m => m.job).join(', ') : 'в партии никого — кроме вас'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
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
        )}

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
