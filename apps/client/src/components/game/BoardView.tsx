import type {
  Building,
  Citizen,
  CitizenPosition,
  PoliceToken,
  Victim
} from '@citykiller/shared';
import { BOARD_HEIGHT, BOARD_WIDTH, KILLS_TO_WIN } from '@citykiller/shared';
import { cn } from '@/lib/utils';
import {
  BUILDING_EMOJI,
  BUILDING_LABELS,
  GROUP_SHORT,
  HEIGHT_SHORT,
  SEX_EMOJI,
  valueLabel
} from '@/lib/labels';

const CITIZEN_COLORS: Record<string, string> = {
  purple: '#8b5cf6',
  blue: '#3b82f6',
  lightBlue: '#38bdf8',
  pink: '#ec4899',
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  orange: '#f97316',
  brown: '#a16207',
  gray: '#6b7280',
  black: '#374151',
  white: '#d1d5db'
};

export interface BoardViewProps {
  citizens: Citizen[];
  positions: CitizenPosition[];
  buildings: Building[];
  detective: { x: number; y: number } | null;
  policeTokens: PoliceToken[];
  victims: Victim[];
  /** Районы, по которым сейчас можно кликнуть */
  highlightDistricts?: Array<{ x: number; y: number }>;
  onDistrictClick?: (x: number, y: number) => void;
  /** Жители, которых сейчас можно выбрать */
  selectableCitizenIds?: number[];
  /** Уже выбранные жители (испуг и т.п.) */
  selectedCitizenIds?: number[];
  /** Особо помеченный житель (жертва) */
  markedCitizenId?: number | null;
  onCitizenClick?: (citizenId: number) => void;
}

export function BoardView({
  citizens,
  positions,
  buildings,
  detective,
  policeTokens,
  victims,
  highlightDistricts = [],
  onDistrictClick,
  selectableCitizenIds = [],
  selectedCitizenIds = [],
  markedCitizenId = null,
  onCitizenClick
}: BoardViewProps) {
  const cells = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      cells.push({ x, y });
    }
  }

  return (
    <div className="w-full h-full flex items-stretch justify-center gap-3 min-h-0">
      {/* Город 4x4 */}
      <div className="flex-1 min-w-0 h-full noir-panel rounded-xl p-3 grid grid-cols-4 grid-rows-4 gap-2">
        {cells.map(({ x, y }) => {
          const isHighlighted = highlightDistricts.some(d => d.x === x && d.y === y);
          const districtCitizens = positions.filter(
            p => p.districtX === x && p.districtY === y && !p.isDead
          );
          const districtBuildings = buildings.filter(
            b => b.districtX === x && b.districtY === y
          );
          const hasCar = detective?.x === x && detective?.y === y;

          return (
            <div
              key={`${x}-${y}`}
              className={cn(
                'relative rounded-lg district-tile transition-all duration-200 overflow-hidden flex flex-col p-1.5 gap-1',
                onDistrictClick && 'district-tile-hover',
                isHighlighted && 'cursor-pointer animate-pulse-glow'
              )}
              onClick={isHighlighted ? () => onDistrictClick?.(x, y) : undefined}
            >
              {/* Шапка квартала: имя + здания + машина */}
              <div className="flex items-center justify-between gap-1 shrink-0 h-5 z-10">
                <span className="text-[10px] font-display tracking-widest text-white/40 select-none">
                  {String.fromCharCode(65 + x)}
                  {y + 1}
                </span>
                <div className="flex items-center gap-1">
                  {districtBuildings.map(b => (
                    <div
                      key={b.id}
                      title={BUILDING_LABELS[b.type]}
                      className="w-6 h-6 rounded bg-black/50 border border-white/25 flex items-center justify-center text-sm shadow"
                    >
                      {BUILDING_EMOJI[b.type]}
                    </div>
                  ))}
                  {hasCar && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-base shadow-xl border-2 animate-fade-in-up"
                      title="Полицейская машина"
                      style={{
                        background: 'linear-gradient(160deg, #1d4ed8, #172554)',
                        borderColor: '#93c5fd',
                        boxShadow: '0 0 14px rgba(59,130,246,0.55)'
                      }}
                    >
                      🚔
                    </div>
                  )}
                </div>
              </div>

              {/* Жители: до 3 карточек на всю высоту квартала */}
              <div className="flex-1 min-h-0 flex gap-1 z-10">
                {districtCitizens.map(pos => {
                  const citizen = citizens.find(c => c.id === pos.citizenId);
                  if (!citizen) return null;
                  const selectable = selectableCitizenIds.includes(pos.citizenId);
                  const selected = selectedCitizenIds.includes(pos.citizenId);
                  const marked = markedCitizenId === pos.citizenId;
                  const hasToken = policeTokens.some(t => t.citizenId === pos.citizenId);
                  const color = CITIZEN_COLORS[citizen.color] ?? '#6b7280';

                  return (
                    <button
                      key={pos.citizenId}
                      type="button"
                      title={`${citizen.job}${pos.isScared ? ' (запуган)' : ''}`}
                      disabled={!selectable}
                      onClick={e => {
                        e.stopPropagation();
                        onCitizenClick?.(pos.citizenId);
                      }}
                      className={cn(
                        'relative flex-1 min-w-0 h-full rounded-md border flex flex-col items-stretch text-left overflow-hidden shadow-lg transition-all duration-150',
                        pos.isScared ? 'border-red-400/70' : 'border-white/15',
                        selectable
                          ? 'cursor-pointer ring-2 ring-yellow-300/80 hover:ring-yellow-200 hover:brightness-125'
                          : 'cursor-default',
                        selected && 'ring-4 ring-orange-400',
                        marked && 'ring-4 ring-red-500'
                      )}
                      style={{
                        background: `linear-gradient(160deg, ${color}33, rgba(0,0,0,0.7))`
                      }}
                    >
                      <div className="h-1 w-full shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-h-0 px-1 py-0.5 flex flex-col gap-px leading-tight">
                        <div className="flex items-start justify-between gap-0.5">
                          <span className="text-[10px] font-semibold text-white truncate">
                            {citizen.job}
                          </span>
                          {hasToken && (
                            <span
                              className="shrink-0 w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center font-bold text-white border border-white/60"
                              style={{ background: '#1d4ed8' }}
                              title="Жетон полиции"
                            >
                              Ж
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/90">
                          {SEX_EMOJI[citizen.sex]} {citizen.sex === 'male' ? 'муж' : 'жен'} · {citizen.age}
                        </div>
                        <div className="text-[10px] text-white/75">
                          {citizen.size} · {HEIGHT_SHORT[citizen.height]}
                        </div>
                        <div className="mt-auto text-[9px] text-white/55 truncate">
                          {GROUP_SHORT[citizen.group]}
                        </div>
                        {pos.isScared && (
                          <div className="text-[9px] text-red-300 font-medium">😰 запуган</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Морг: трекер пяти убийств */}
      <div className="h-full w-44 shrink-0 noir-panel rounded-xl p-2.5 flex flex-col gap-2">
        <div className="text-center font-display text-sm tracking-[0.25em] uppercase text-red-400/90">
          Морг
        </div>
        {Array.from({ length: KILLS_TO_WIN }, (_, i) => {
          const victim = victims[i];
          const citizen = victim ? citizens.find(c => c.id === victim.citizenId) : null;
          return (
            <div
              key={i}
              className={cn(
                'flex-1 min-h-0 rounded-lg border p-2 flex flex-col justify-center',
                citizen
                  ? 'animate-corpse-in border-red-900/80'
                  : 'border-dashed border-white/15'
              )}
              style={
                citizen
                  ? {
                      background:
                        'linear-gradient(160deg, rgba(127,29,29,0.35), rgba(20,10,10,0.6))'
                    }
                  : undefined
              }
            >
              {citizen && victim ? (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold truncate">{citizen.job}</span>
                    <span className="text-sm">💀</span>
                  </div>
                  <div className="text-[10px] text-red-200/70 leading-tight">
                    {citizen.sex === 'male' ? 'М' : 'Ж'} · {citizen.age} · {citizen.size} ·{' '}
                    {valueLabel('height', citizen.height)}
                  </div>
                  <div className="text-[10px] text-white/40">
                    Квартал {String.fromCharCode(65 + victim.districtX)}
                    {victim.districtY + 1} · ночь {victim.turnNumber}
                  </div>
                </div>
              ) : (
                <div className="text-center text-white/20 select-none">
                  <div className="text-lg">⚰️</div>
                  <div className="text-[10px] tracking-widest">ЖЕРТВА {i + 1}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
