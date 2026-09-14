import { MAX_CITIZENS_PER_DISTRICT, getNeighbors } from '../board';
import type { CitizenGroup, CitizenPosition, CityMoveCommand, GameState } from '../types';

export type GroupMoves = CityMoveCommand['moves'];

/**
 * Все допустимые перемещения показанной группы в фазе Города: каждый житель
 * остаётся на месте или сдвигается в соседний район — не на место преступления
 * и не туда, где уже трое. Проверки те же, что в applyCityMove, поэтому любой
 * вариант движок примет. Первым всегда идёт «никого не двигать».
 *
 * Перебор ограничен maxMembers жителями (5^4 = 625 вариантов): остальные стоят.
 */
export function enumerateGroupMoves(state: GameState, group: CitizenGroup, maxMembers = 4): GroupMoves[] {
  const isCrime = (x: number, y: number) => state.victims.some(v => v.districtX === x && v.districtY === y);
  const members = state.positions
    .filter(p => !p.isDead && state.citizens.find(c => c.id === p.citizenId)?.group === group)
    .slice(0, maxMembers);

  const counts = new Map<string, number>();
  for (const p of state.positions) {
    if (p.isDead) continue;
    const key = `${p.districtX},${p.districtY}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const results: GroupMoves[] = [];
  const current: GroupMoves = [];
  const walk = (i: number): void => {
    if (i === members.length) {
      results.push([...current]);
      return;
    }
    const p = members[i];
    walk(i + 1); // остаться на месте
    const from = `${p.districtX},${p.districtY}`;
    for (const n of getNeighbors(p.districtX, p.districtY)) {
      if (isCrime(n.x, n.y)) continue;
      const to = `${n.x},${n.y}`;
      // проверяем при каждом заходе: дальше счётчики только убывают, итог тоже в пределах
      if ((counts.get(to) ?? 0) >= MAX_CITIZENS_PER_DISTRICT) continue;
      counts.set(to, (counts.get(to) ?? 0) + 1);
      counts.set(from, (counts.get(from) ?? 0) - 1);
      current.push({ citizenId: p.citizenId, toX: n.x, toY: n.y });
      walk(i + 1);
      current.pop();
      counts.set(to, (counts.get(to) ?? 0) - 1);
      counts.set(from, (counts.get(from) ?? 0) + 1);
    }
  };
  walk(0);
  return results;
}

/** Положения жителей после перемещений — копия, исходное состояние не трогаем */
export function positionsAfter(state: GameState, moves: GroupMoves): CitizenPosition[] {
  return state.positions.map(p => {
    const move = moves.find(m => m.citizenId === p.citizenId);
    return move ? { ...p, districtX: move.toX, districtY: move.toY } : p;
  });
}
