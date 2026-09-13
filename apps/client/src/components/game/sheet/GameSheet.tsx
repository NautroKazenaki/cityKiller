import { useMemo } from 'react';
import type { Building, Citizen, CitizenPosition, PoliceToken, Victim } from '@citykiller/shared';
import { KILLS_TO_WIN } from '@citykiller/shared';
import { FONT, LAYOUT, P, SHADOW } from '@/design/tokens';
import { generateCityIn, seedFromId } from '@/design/cityArt';
import { GROUP_CHIT, groupRing } from '@/design/city';
import { HEIGHT_SHORT } from '@/lib/labels';
import { DistrictCell } from './DistrictCell';
import { DetectiveCar } from './DetectiveCar';
import { useChitFlip } from './useChitFlip';
import type { ChitMarker } from './Chit';

export interface GameSheetProps {
  gameId: string;
  citizens: Citizen[];
  positions: CitizenPosition[];
  buildings: Building[];
  detective: { x: number; y: number } | null;
  policeTokens: PoliceToken[];
  victims: Victim[];
  availableDistricts?: Array<{ x: number; y: number }>;
  selectedDistrict?: { x: number; y: number } | null;
  onDistrictClick?: (x: number, y: number) => void;
  selectableCitizenIds?: number[];
  /** Жители, выбранные для текущего перемещения */
  pendingCitizenIds?: number[];
  /** Ночные метки убийцы */
  markers?: Record<number, ChitMarker>;
  /** Ночь: холодный слой над картой, акцент уходит в кровавый */
  night?: boolean;
  onCitizenClick?: (citizenId: number) => void;
}

const PHASE_RULES = [
  {
    n: '1',
    text: 'Ночь: убийца пугает двоих и убивает одного',
    bd: 'oklch(0.5 0.12 300)',
    bg: 'oklch(0.86 0.04 300)',
    numFg: 'oklch(0.35 0.1 300)'
  },
  {
    n: '2',
    text: 'Место преступления: машина выезжает, жители расселяются',
    bd: 'oklch(0.45 0.1 27)',
    bg: 'oklch(0.88 0.035 40)',
    numFg: 'oklch(0.4 0.1 30)'
  },
  {
    n: '3',
    text: 'День: 2 перемещения и 2 возможности детектива',
    bd: 'oklch(0.55 0.12 78)',
    bg: 'oklch(0.88 0.06 82)',
    numFg: 'oklch(0.4 0.1 72)'
  }
];

const ROW_MARKS = [
  { n: '1', flex: '690 0 0', bg: 'oklch(0.87 0.028 82)' },
  { n: '2', flex: '690 0 0', bg: 'oklch(0.9 0.024 84)' },
  { n: '3', flex: '690 0 0', bg: 'oklch(0.87 0.028 82)' },
  { n: '4', flex: '690 0 0', bg: 'oklch(0.9 0.024 84)' },
  { n: '5', flex: '480 0 0', bg: 'oklch(0.82 0.035 80)' }
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V · ФИНАЛ'];

/**
 * Игровой лист: 690 город + 30 полоса рядов по ширине, 690 город + 120 пятый ряд по высоте.
 * Единственный светлый объект на экране и единственная кликабельная поверхность игры.
 */
export function GameSheet({
  gameId,
  citizens,
  positions,
  buildings,
  detective,
  policeTokens,
  victims,
  availableDistricts = [],
  selectedDistrict = null,
  onDistrictClick,
  selectableCitizenIds = [],
  pendingCitizenIds = [],
  markers = {},
  night = false,
  onCitizenClick
}: GameSheetProps) {
  const art = useMemo(() => generateCityIn(1000, 1000, seedFromId(gameId), 17), [gameId]);
  const tokenIds = policeTokens.map(t => t.citizenId);
  const registerChit = useChitFlip(positions);
  const carOnCrime =
    !!detective && victims.some(v => v.districtX === detective.x && v.districtY === detective.y);

  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) cells.push({ x, y });

  return (
    <div
      style={{
        position: 'relative',
        width: LAYOUT.sheet,
        height: LAYOUT.sheetHeight,
        flexShrink: 0,
        background: P.paper,
        borderRadius: 2,
        boxShadow: SHADOW.sheet,
        overflow: 'hidden'
      }}
    >
      {/* зернистость бумаги */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 6,
          opacity: 0.5,
          backgroundImage: 'radial-gradient(oklch(0.5 0.04 60 / .09) 0.5px, transparent 0.5px)',
          backgroundSize: '3px 3px'
        }}
      />
      {/* пятна и износ */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 6,
          background:
            'radial-gradient(circle 90px at 88% 8%, oklch(0.72 0.06 65 / .16), transparent 70%), radial-gradient(circle 60px at 12% 62%, oklch(0.7 0.05 60 / .13), transparent 70%), radial-gradient(ellipse 120% 60% at 50% 120%, oklch(0.45 0.03 60 / .12), transparent 70%)'
        }}
      />

      {/* ---- ГОРОД ---- */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: LAYOUT.city, height: LAYOUT.city }}>
        {/* слой 1: арт города */}
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        >
          <rect x="0" y="0" width="1000" height="1000" fill="oklch(0.80 0.038 78)" />
          {art.blocks.map((b, i) => (
            <rect key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill="oklch(0.948 0.016 88)" />
          ))}
          <polygon
            points="0,0 1000,0 1000,54 830,92 650,66 470,104 300,80 140,128 0,146"
            fill="oklch(0.855 0.028 226)"
          />
          <polygon points="1000,392 1000,474 648,1000 516,1000" fill="oklch(0.855 0.028 226)" />
          <rect x="516" y="470" width="196" height="176" rx="6" fill="oklch(0.865 0.038 132)" />
          <rect x="112" y="702" width="158" height="126" rx="6" fill="oklch(0.865 0.038 132)" />
          <ellipse
            cx="180"
            cy="880"
            rx="56"
            ry="38"
            fill="none"
            stroke="oklch(0.74 0.03 78)"
            strokeWidth={9}
          />
          <circle cx="606" cy="306" r="26" fill="none" stroke="oklch(0.80 0.038 78)" strokeWidth={14} />
          {art.buildings.map((u, i) => (
            <rect key={`u${i}`} x={u.x} y={u.y} width={u.w} height={u.h} fill="oklch(0.862 0.026 80)" />
          ))}
        </svg>

        {/* ночной слой: холодный полумрак наезжает на бумагу за 900 мс */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
            opacity: night ? 1 : 0,
            transition: 'opacity .9s ease-in-out',
            background:
              'linear-gradient(180deg, oklch(0.3 0.06 285 / .82), oklch(0.24 0.05 285 / .88))'
          }}
        />

        {/* слой 2: высечка районов */}
        <svg
          viewBox="0 0 690 690"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            zIndex: 3,
            pointerEvents: 'none'
          }}
        >
          <g
            stroke={night ? 'oklch(0.62 0.05 285)' : 'oklch(0.3 0.02 60)'}
            strokeWidth={1.5}
            strokeDasharray="9 6"
            opacity={night ? 0.55 : 0.72}
          >
            <line x1="172.5" y1="0" x2="172.5" y2="690" />
            <line x1="345" y1="0" x2="345" y2="690" />
            <line x1="517.5" y1="0" x2="517.5" y2="690" />
            <line x1="0" y1="172.5" x2="690" y2="172.5" />
            <line x1="0" y1="345" x2="690" y2="345" />
            <line x1="0" y1="517.5" x2="690" y2="517.5" />
          </g>
          <line
            x1="345"
            y1="0"
            x2="345"
            y2="690"
            stroke={night ? 'oklch(0.58 0.05 285)' : 'oklch(0.28 0.02 60)'}
            strokeWidth={3}
          />
          <line
            x1="0"
            y1="345"
            x2="690"
            y2="345"
            stroke={night ? 'oklch(0.58 0.05 285)' : 'oklch(0.28 0.02 60)'}
            strokeWidth={3}
          />
          <rect
            x="3"
            y="3"
            width="684"
            height="684"
            fill="none"
            stroke={night ? 'oklch(0.52 0.05 285)' : 'oklch(0.24 0.02 60)'}
            strokeWidth={6}
          />
        </svg>

        {/* слой 3: интерактив */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gridTemplateRows: 'repeat(4,1fr)'
          }}
        >
          {cells.map(({ x, y }) => (
            <DistrictCell
              key={`${x}-${y}`}
              x={x}
              y={y}
              citizens={citizens}
              positions={positions}
              building={buildings.find(b => b.districtX === x && b.districtY === y)}
              hasCar={detective?.x === x && detective?.y === y}
              crime={victims.find(v => v.districtX === x && v.districtY === y)}
              selected={selectedDistrict?.x === x && selectedDistrict?.y === y}
              available={availableDistricts.some(d => d.x === x && d.y === y)}
              policeTokenIds={tokenIds}
              selectableCitizenIds={selectableCitizenIds}
              pendingCitizenIds={pendingCitizenIds}
              markers={markers}
              night={night}
              registerChit={registerChit}
              onDistrictClick={onDistrictClick ? () => onDistrictClick(x, y) : undefined}
              onCitizenClick={onCitizenClick}
            />
          ))}
        </div>

        {/* фишка детектива едет над сеткой районов */}
        <DetectiveCar district={detective} withCrime={carOnCrime} />
      </div>

      {/* ---- ПОЛОСА НОМЕРОВ РЯДОВ ---- */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: LAYOUT.rowStrip,
          height: LAYOUT.sheetHeight,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid oklch(0.55 0.03 60 / .45)'
        }}
      >
        {ROW_MARKS.map(r => (
          <div
            key={r.n}
            style={{
              flex: r.flex,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: r.bg,
              borderBottom: '1px solid oklch(0.6 0.03 60 / .35)'
            }}
          >
            <span
              style={{
                fontFamily: FONT.display,
                fontSize: 20,
                fontWeight: 800,
                color: 'oklch(0.4 0.03 60)'
              }}
            >
              {r.n}
            </span>
          </div>
        ))}
      </div>

      {/* ---- ПЯТЫЙ РЯД ---- */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: LAYOUT.city,
          height: LAYOUT.fifthRow,
          borderTop: '6px solid oklch(0.24 0.02 60)',
          boxSizing: 'border-box',
          display: 'flex'
        }}
      >
        {/* трек мест преступлений */}
        <div style={{ flex: 1, minWidth: 0, padding: '9px 11px', boxSizing: 'border-box' }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 8.5,
              letterSpacing: '0.24em',
              color: 'oklch(0.42 0.03 50)',
              marginBottom: 7
            }}
          >
            МЕСТА ПРЕСТУПЛЕНИЙ · ПЯТОЕ ЗАКРЫВАЕТ ДЕЛО
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {Array.from({ length: KILLS_TO_WIN }, (_, i) => {
              const victim = victims[i];
              const citizen = victim ? citizens.find(c => c.id === victim.citizenId) : undefined;
              const last = i === KILLS_TO_WIN - 1;
              return (
                <div
                  key={i}
                  style={{
                    width: 72,
                    height: 76,
                    borderRadius: 1,
                    border: citizen
                      ? '1px solid oklch(0.45 0.1 27)'
                      : last
                        ? '1px dashed oklch(0.45 0.1 27 / .7)'
                        : '1px dashed oklch(0.5 0.03 55 / .55)',
                    background: citizen
                      ? 'oklch(0.88 0.035 40)'
                      : last
                        ? 'oklch(0.88 0.02 40 / .4)'
                        : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {citizen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 5,
                        background: groupRing(citizen.group)
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 8,
                      letterSpacing: '0.12em',
                      color: citizen || last ? 'oklch(0.45 0.1 30)' : 'oklch(0.55 0.03 55)'
                    }}
                  >
                    {citizen ? `НОЧЬ ${victim!.turnNumber}` : ROMAN[i]}
                  </span>
                  {citizen && (
                    <>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'oklch(0.3 0.04 40)',
                          textAlign: 'center',
                          lineHeight: 1.15,
                          padding: '0 3px'
                        }}
                      >
                        {citizen.job}
                      </span>
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 8.5,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          color: 'oklch(0.34 0.03 45)',
                          textAlign: 'center',
                          lineHeight: 1.2
                        }}
                      >
                        {GROUP_CHIT[citizen.group]}
                      </span>
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 8,
                          color: 'oklch(0.45 0.03 45)',
                          textAlign: 'center',
                          lineHeight: 1.2
                        }}
                      >
                        {citizen.sex === 'male' ? 'М' : 'Ж'} · {citizen.age} · {citizen.size} ·{' '}
                        {HEIGHT_SHORT[citizen.height]}
                      </span>
                      {/* был ли запуган — прямая улика против мотива «садист» */}
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 8,
                          letterSpacing: '0.08em',
                          padding: '1px 5px',
                          borderRadius: 2,
                          background: victim!.wasScared
                            ? 'oklch(0.62 0.13 300 / .3)'
                            : 'transparent',
                          border: victim!.wasScared
                            ? '1px solid oklch(0.5 0.12 300)'
                            : '1px solid oklch(0.6 0.02 55 / .5)',
                          color: victim!.wasScared
                            ? 'oklch(0.34 0.12 300)'
                            : 'oklch(0.5 0.02 55)'
                        }}
                      >
                        {victim!.wasScared ? 'ЗАПУГАН' : 'НЕ ЗАПУГАН'}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* порядок хода */}
        <div
          style={{
            width: 250,
            flexShrink: 0,
            borderLeft: '1px dashed oklch(0.45 0.03 55 / .6)',
            padding: '9px 11px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 8.5,
              letterSpacing: '0.24em',
              color: 'oklch(0.42 0.03 50)',
              marginBottom: 7
            }}
          >
            ПОРЯДОК ХОДА
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {PHASE_RULES.map(pr => (
              <div key={pr.n} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 9999,
                    border: `1.5px solid ${pr.bd}`,
                    background: pr.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONT.mono,
                    fontSize: 8,
                    fontWeight: 600,
                    color: pr.numFg,
                    flexShrink: 0
                  }}
                >
                  {pr.n}
                </span>
                <span style={{ fontSize: 10.5, lineHeight: 1.3, color: 'oklch(0.32 0.02 55)' }}>
                  {pr.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
