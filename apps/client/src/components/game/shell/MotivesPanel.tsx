import { MOTIVE_DESCRIPTORS } from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';

interface MotivesPanelProps {
  /** Кандидаты, среди которых ровно один настоящий */
  motiveOptions: string[];
  /** Мотивы, вычеркнутые детективом — личные пометки, движок о них не знает */
  crossed: string[];
  onToggle: (motiveId: string) => void;
  compact?: boolean;
}

/**
 * Список мотивов-кандидатов. Детектив видит их с первого хода — иначе угадать
 * мотив в финале невозможно. Вычеркнутые мотивы — заметки на полях, не состояние игры.
 */
export function MotivesPanel({ motiveOptions, crossed, onToggle, compact }: MotivesPanelProps) {
  const motives = MOTIVE_DESCRIPTORS.filter(m => motiveOptions.includes(m.id));
  const left = motives.length - crossed.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.24em', color: P.gold }}
          >
            МОТИВ УБИЙЦЫ · ОДИН ИЗ ЭТИХ
          </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              letterSpacing: '0.14em',
              padding: '3px 7px',
              borderRadius: 2,
              background: 'oklch(0.28 0.015 55)',
              color: 'oklch(0.72 0.014 80)'
            }}
          >
            ОСТАЛОСЬ {left}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {motives.map(m => {
          const off = crossed.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              title={off ? 'Вернуть мотив в список' : 'Вычеркнуть: этот мотив не подходит'}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '9px 11px',
                borderRadius: 4,
                border: `1px solid ${off ? 'oklch(0.28 0.014 55)' : 'oklch(0.36 0.015 55)'}`,
                background: off ? 'transparent' : 'oklch(0.26 0.014 55)',
                cursor: 'pointer',
                textAlign: 'left',
                opacity: off ? 0.45 : 1,
                transition: 'opacity .15s ease'
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  marginTop: 2,
                  borderRadius: 2,
                  border: `1.5px solid ${off ? 'oklch(0.45 0.1 27)' : 'oklch(0.45 0.02 60)'}`,
                  background: off ? 'oklch(0.3 0.06 27)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'oklch(0.85 0.1 30)',
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  lineHeight: 1
                }}
              >
                {off ? '×' : ''}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: FONT.display,
                    fontSize: 19,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    color: P.ink,
                    textDecoration: off ? 'line-through' : 'none'
                  }}
                >
                  {m.title}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11.5,
                    lineHeight: 1.4,
                    marginTop: 4,
                    color: 'oklch(0.66 0.014 80)'
                  }}
                >
                  {m.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!compact && (
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'oklch(0.58 0.014 80)' }}>
          Вычеркните мотивы, которые не сходятся с картиной убийств. Это ваши пометки — убийца их
          не видит.
        </p>
      )}
    </div>
  );
}
