import type { Building, Citizen, CitizenPosition, Victim } from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';
import { BUILDING_SHORT, buildingPath, districtTitle } from '@/design/city';
import { BUILDING_LABELS } from '@/lib/labels';
import { Chit, type ChitMarker } from './Chit';

export interface DistrictCellProps {
  x: number;
  y: number;
  citizens: Citizen[];
  positions: CitizenPosition[];
  building?: Building;
  hasCar: boolean;
  crime?: Victim;
  selected: boolean;
  available: boolean;
  policeTokenIds: number[];
  selectableCitizenIds: number[];
  /** Жители, выбранные для текущего перемещения */
  pendingCitizenIds: number[];
  /** Ночные метки убийцы: жертва, испуг, своя личность */
  markers: Record<number, ChitMarker>;
  night: boolean;
  registerChit?: (citizenId: number, el: HTMLElement | null) => void;
  onDistrictClick?: () => void;
  onCitizenClick?: (citizenId: number) => void;
}

/**
 * Район на игровом листе. Своего фона, рамки и радиуса не имеет — существует
 * за счёт сквозного арта, пунктирной высечки и таблички.
 */
export function DistrictCell({
  x,
  y,
  citizens,
  positions,
  building,
  hasCar,
  crime,
  selected,
  available,
  policeTokenIds,
  selectableCitizenIds,
  pendingCitizenIds,
  markers,
  night,
  registerChit,
  onDistrictClick,
  onCitizenClick
}: DistrictCellProps) {
  const clickable = available || selected || !!onDistrictClick;
  const here = positions.filter(p => p.districtX === x && p.districtY === y && !p.isDead);

  // ночью акцент меняется с золотого на кровавый, табличка уходит в холодный полумрак
  const accentWash = night ? 'oklch(0.58 0.16 27 / .2)' : 'oklch(0.72 0.12 78 / .16)';
  const accentHint = night ? 'oklch(0.58 0.16 27 / .1)' : 'oklch(0.72 0.12 78 / .07)';
  const accentFrame = night ? 'oklch(0.5 0.16 27)' : 'oklch(0.5 0.13 78)';

  const plateBg = selected ? accentFrame : night ? 'oklch(0.62 0.05 285 / .5)' : 'oklch(0.93 0.02 85 / .86)';
  const plateBd = selected
    ? night
      ? 'oklch(0.42 0.13 27)'
      : 'oklch(0.4 0.11 72)'
    : night
      ? 'oklch(0.72 0.05 285 / .5)'
      : 'oklch(0.4 0.03 60 / .45)';
  const plateFg = selected ? 'oklch(0.97 0.02 85)' : night ? 'oklch(0.94 0.02 285)' : P.paperInk;

  return (
    <div
      onClick={clickable ? onDistrictClick : undefined}
      style={{
        position: 'relative',
        padding: 7,
        boxSizing: 'border-box',
        cursor: available || selected ? 'pointer' : 'default',
        background: selected ? accentWash : available ? accentHint : 'transparent',
        boxShadow: selected ? `inset 0 0 0 3px ${accentFrame}` : 'none',
        transition: 'background .18s ease'
      }}
    >
      {/* табличка района */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: '100%',
          background: plateBg,
          border: `1px solid ${plateBd}`,
          borderRadius: 2,
          padding: '2.5px 6px'
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: plateFg,
            whiteSpace: 'nowrap'
          }}
        >
          {districtTitle(x, y)}
        </span>
      </div>

      {/* здание — латунная табличка, вклеенная в план */}
      {building && (
        <div
          title={BUILDING_LABELS[building.type]}
          style={{
            position: 'absolute',
            right: 7,
            top: 7,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'oklch(0.34 0.02 60)',
            borderRadius: 2,
            padding: '3px 6px 3px 4px',
            boxShadow: '0 1px 0 oklch(0.6 0.03 65 / .45) inset, 0 2px 4px rgba(0,0,0,.3)'
          }}
        >
          <svg
            viewBox="0 0 24 24"
            style={{ width: 13, height: 13, display: 'block', flexShrink: 0 }}
            fill="none"
            stroke="oklch(0.86 0.09 82)"
            strokeWidth={2}
            strokeLinecap="square"
          >
            <path d={buildingPath(building.type)} />
          </svg>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 8,
              letterSpacing: '0.14em',
              color: 'oklch(0.86 0.09 82)'
            }}
          >
            {BUILDING_SHORT[building.type]}
          </span>
        </div>
      )}

      {/* угловые скобки доступности — единственная бесконечная анимация карты */}
      {available && !selected && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 5,
            width: 'calc(100% - 10px)',
            height: 'calc(100% - 10px)',
            pointerEvents: 'none',
            animation: 'ck-avail 1.9s ease-in-out infinite'
          }}
        >
          <g fill="none" stroke={night ? 'oklch(0.55 0.16 27)' : 'oklch(0.46 0.14 72)'} strokeWidth={4}>
            <path d="M0 14 L0 0 L14 0" />
            <path d="M86 0 L100 0 L100 14" />
            <path d="M100 86 L100 100 L86 100" />
            <path d="M14 100 L0 100 L0 86" />
          </g>
        </svg>
      )}

      {/* жетоны жителей — внизу района, по центру, максимум три */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 9,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 5,
          padding: '0 7px'
        }}
      >
        {here.map(pos => {
          const citizen = citizens.find(c => c.id === pos.citizenId);
          if (!citizen) return null;
          return (
            <Chit
              key={pos.citizenId}
              citizen={citizen}
              big={here.length === 1}
              scared={pos.isScared}
              token={policeTokenIds.includes(pos.citizenId)}
              selectable={selectableCitizenIds.includes(pos.citizenId)}
              pending={pendingCitizenIds.includes(pos.citizenId)}
              marker={markers[pos.citizenId] ?? null}
              register={el => registerChit?.(pos.citizenId, el)}
              onClick={() => onCitizenClick?.(pos.citizenId)}
            />
          );
        })}
      </div>

      {/* карточка места преступления */}
      {crime && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 84,
            height: 58,
            // машина приезжает на место преступления — карточка и фишка не должны налезать друг на друга
            transform: `translate(-50%,${hasCar ? '-96%' : '-50%'}) rotate(${
              crime.turnNumber % 2 === 0 ? 3 : -4
            }deg)`,
            background: 'oklch(0.9 0.024 82)',
            border: '1px solid oklch(0.4 0.03 40)',
            borderRadius: 1,
            boxShadow: '0 6px 14px -4px rgba(0,0,0,.55)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            pointerEvents: 'none',
            // убийство: карточка проявляется на месте жетона, 600 мс
            animation: 'ck-crime .6s ease-out'
          }}
        >
          <div
            style={{
              width: '100%',
              height: 5,
              background:
                'repeating-linear-gradient(90deg, oklch(0.58 0.16 27) 0 7px, oklch(0.9 0.024 82) 7px 14px)',
              position: 'absolute',
              top: 0
            }}
          />
          <svg
            viewBox="0 0 24 24"
            style={{ width: 17, height: 17, marginTop: 4 }}
            fill="none"
            stroke="oklch(0.42 0.14 27)"
            strokeWidth={1.8}
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21c0-4 3.2-6 7-6s7 2 7 6" />
            <path d="M3 3l18 18" />
          </svg>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 7,
              letterSpacing: '0.14em',
              color: 'oklch(0.4 0.05 40)'
            }}
          >
            НОЧЬ {crime.turnNumber}
          </span>
        </div>
      )}

    </div>
  );
}
