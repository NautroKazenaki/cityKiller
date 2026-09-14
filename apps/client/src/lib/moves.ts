import type { CitizenPosition, Victim } from '@citykiller/shared';
import { MAX_CITIZENS_PER_DISTRICT, getNeighbors } from '@citykiller/shared';

export type District = { x: number; y: number };
/** Запланированные переезды: житель → район назначения */
export type PlannedMoves = Record<number, District>;

/** Сколько живых жителей окажется в районе после запланированных переездов */
function plannedOccupancy(positions: CitizenPosition[], moves: PlannedMoves, d: District): number {
  let count = 0;
  for (const p of positions) {
    if (p.isDead) continue;
    const to = moves[p.citizenId];
    const x = to ? to.x : p.districtX;
    const y = to ? to.y : p.districtY;
    if (x === d.x && y === d.y) count++;
  }
  return count;
}

function allDistricts(): District[] {
  const list: District[] = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) list.push({ x, y });
  return list;
}

/**
 * Куда можно переставить жителя — те же проверки, что делает движок.
 *
 * Без этого карта принимала клик по любому району: сервер отклонял переезд
 * (там уже трое или место преступления), а житель оставался «назначенным»,
 * и перевыбрать его было нельзя — партия вставала намертво.
 */
export function moveTargets(opts: {
  positions: CitizenPosition[];
  victims: Victim[];
  citizenId: number;
  moves: PlannedMoves;
  /** Расселение с места преступления — свои правила, см. applyRelocate */
  relocation?: { crime: District };
}): District[] {
  const { positions, victims, citizenId, moves, relocation } = opts;
  const pos = positions.find(p => p.citizenId === citizenId);
  if (!pos || pos.isDead) return [];

  // свой запланированный переезд не считаем — житель как будто ещё на месте
  const others: PlannedMoves = { ...moves };
  delete others[citizenId];
  const hasRoom = (d: District) => plannedOccupancy(positions, others, d) < MAX_CITIZENS_PER_DISTRICT;

  if (relocation) {
    const { crime } = relocation;
    const neighbors = getNeighbors(crime.x, crime.y);
    // исключение правил: все соседи забиты — можно расселять в любой квартал
    const allNeighborsFull = neighbors.every(
      n =>
        positions.filter(p => !p.isDead && p.districtX === n.x && p.districtY === n.y).length >=
        MAX_CITIZENS_PER_DISTRICT
    );
    const pool = allNeighborsFull ? allDistricts() : neighbors;
    return pool.filter(d => !(d.x === crime.x && d.y === crime.y) && hasRoom(d));
  }

  // пожарные и фаза Города: на один район, мимо мест преступлений
  return getNeighbors(pos.districtX, pos.districtY).filter(
    d => !victims.some(v => v.districtX === d.x && v.districtY === d.y) && hasRoom(d)
  );
}
