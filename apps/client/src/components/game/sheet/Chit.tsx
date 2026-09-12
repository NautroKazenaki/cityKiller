import type { Citizen } from '@citykiller/shared';
import { FONT, P, SHADOW } from '@/design/tokens';
import { GROUP_CHIT, chitRing, monogram } from '@/design/city';

interface ChitProps {
  citizen: Citizen;
  /** Один житель в районе — жетон крупнее (52 px), два-три — по 46 px */
  big: boolean;
  scared: boolean;
  token: boolean;
  selectable: boolean;
  selected: boolean;
  marked: boolean;
  onClick?: () => void;
}

/**
 * Жетон жителя: кольцо — цвет жителя, ядро — бумага, инициал профессии — display,
 * под ним группа моно-шрифтом. Состояния — накладки поверх жетона, а не иконки рядом.
 */
export function Chit({
  citizen,
  big,
  scared,
  token,
  selectable,
  selected,
  marked,
  onClick
}: ChitProps) {
  const size = big ? 52 : 46;
  const ring = chitRing(citizen.color);

  return (
    <div
      title={`${citizen.job} · ${GROUP_CHIT[citizen.group]}${scared ? ' · запуган' : ''}`}
      onClick={
        selectable && onClick
          ? e => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 9999,
        background: P.paper,
        border: `2.5px solid ${ring}`,
        boxShadow: SHADOW.card,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: selectable ? 'pointer' : 'default',
        flexShrink: 0,
        opacity: selectable || selected || marked ? 1 : 0.92,
        transition: 'transform .18s ease, opacity .18s ease',
        transform: marked ? 'translateY(-3px)' : 'none'
      }}
    >
      <span
        style={{
          fontFamily: FONT.display,
          fontSize: big ? 22 : 19,
          fontWeight: 800,
          lineHeight: 0.85,
          color: P.paperInk
        }}
      >
        {monogram(citizen.job)}
      </span>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 6.5,
          letterSpacing: '0.06em',
          color: 'oklch(0.46 0.02 60)',
          marginTop: 1
        }}
      >
        {GROUP_CHIT[citizen.group]}
      </span>

      {/* Испуг: штриховка поверх жетона */}
      {scared && (
        <span
          style={{
            position: 'absolute',
            left: -2,
            right: -2,
            top: -2,
            bottom: -2,
            borderRadius: 9999,
            background:
              'repeating-linear-gradient(135deg, oklch(0.58 0.16 27 / .32) 0 2px, transparent 2px 5px)',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Доступен для действия — тонкое золотое кольцо */}
      {selectable && (
        <span
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 9999,
            border: `2px solid ${selected || marked ? 'oklch(0.72 0.12 78)' : 'oklch(0.72 0.12 78 / .55)'}`,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Выбран для текущего действия */}
      {(selected || marked) && (
        <span
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: 9999,
            border: `2px solid ${marked ? P.blood : P.gold}`,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Жетон полиции */}
      {token && (
        <span
          title="Жетон полиции"
          style={{
            position: 'absolute',
            right: -5,
            top: -5,
            width: 16,
            height: 16,
            borderRadius: 9999,
            background: P.police,
            border: '1.5px solid oklch(0.9 0.03 250)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT.mono,
            fontSize: 8,
            fontWeight: 600,
            color: '#fff',
            boxShadow: '0 2px 3px rgba(0,0,0,.45)'
          }}
        >
          Ж
        </span>
      )}
    </div>
  );
}
