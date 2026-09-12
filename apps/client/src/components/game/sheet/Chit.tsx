import type { Citizen } from '@citykiller/shared';
import { FONT, P, SHADOW } from '@/design/tokens';
import { GROUP_CHIT, chitRing, monogram } from '@/design/city';

/** Ночные метки убийцы: жертва, испуг, собственная личность */
export type ChitMarker = 'victim' | 'scare' | 'self';

interface ChitProps {
  citizen: Citizen;
  /** Один житель в районе — жетон крупнее (52 px), два-три — по 46 px */
  big: boolean;
  scared: boolean;
  token: boolean;
  selectable: boolean;
  /** Выбран для текущего перемещения */
  pending?: boolean;
  marker?: ChitMarker | null;
  /** Регистрация узла для FLIP-переезда между районами */
  register?: (el: HTMLElement | null) => void;
  onClick?: () => void;
}

const MARKERS: Record<
  ChitMarker,
  { inset: number; border: string; shadow?: string; label: string; labelFg: string; top?: boolean }
> = {
  victim: {
    inset: -7,
    border: `3px solid ${P.blood}`,
    shadow: '0 0 0 3px oklch(0.58 0.16 27 / .25)',
    label: 'ЖЕРТВА',
    labelFg: 'oklch(0.8 0.14 30)'
  },
  scare: {
    inset: -5,
    border: '2.5px dashed oklch(0.7 0.12 300)',
    label: 'ИСПУГ',
    labelFg: 'oklch(0.78 0.1 300)'
  },
  self: {
    inset: -8,
    border: `2px solid ${P.gold}`,
    label: 'ЭТО ВЫ',
    labelFg: 'oklch(0.8 0.11 80)',
    top: true
  }
};

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
  pending = false,
  marker = null,
  register,
  onClick
}: ChitProps) {
  const size = big ? 52 : 46;
  const ring = chitRing(citizen.color);
  const m = marker ? MARKERS[marker] : null;

  return (
    <div
      ref={register}
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
        transition: 'transform .18s ease',
        transform: pending ? 'translateY(-3px)' : 'none'
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

      {/* Доступен для действия */}
      {selectable && !m && (
        <span
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 9999,
            border: `2px solid ${pending ? P.gold : 'oklch(0.72 0.12 78 / .55)'}`,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Ночная метка убийцы */}
      {m && (
        <>
          <span
            style={{
              position: 'absolute',
              inset: m.inset,
              borderRadius: 9999,
              border: m.border,
              boxShadow: m.shadow,
              pointerEvents: 'none'
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              [m.top ? 'top' : 'bottom']: m.top ? -22 : -24,
              transform: 'translateX(-50%)',
              fontFamily: FONT.mono,
              fontSize: 8,
              letterSpacing: '0.16em',
              color: m.labelFg,
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}
          >
            {m.label}
          </span>
        </>
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
