import { CitizenPosition } from './types';

export const BOARD_WIDTH = 4;
export const BOARD_HEIGHT = 4;
/** Максимум жителей (живых) в одном районе */
export const MAX_CITIZENS_PER_DISTRICT = 3;
export const KILLS_TO_WIN = 5;
export const SCARES_PER_NIGHT = 2;

export function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT;
}

export function isCorner(x: number, y: number): boolean {
  return (x === 0 || x === BOARD_WIDTH - 1) && (y === 0 || y === BOARD_HEIGHT - 1);
}

/** Центр города: внутренние районы без границы */
export function isCityCenter(x: number, y: number): boolean {
  return x > 0 && x < BOARD_WIDTH - 1 && y > 0 && y < BOARD_HEIGHT - 1;
}

export function isSameDistrict(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Ортогональные соседи (вверх/вниз/влево/вправо) */
export function getNeighbors(x: number, y: number): Array<{ x: number; y: number }> {
  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];
  return deltas
    .map(({ dx, dy }) => ({ x: x + dx, y: y + dy }))
    .filter(p => isInsideBoard(p.x, p.y));
}

export function areNeighbors(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function aliveCitizensIn(
  positions: CitizenPosition[],
  x: number,
  y: number
): CitizenPosition[] {
  return positions.filter(p => p.districtX === x && p.districtY === y && !p.isDead);
}

/** Свободная субпозиция (1..3) в районе для отрисовки */
export function nextSubPosition(positions: CitizenPosition[], x: number, y: number): 1 | 2 | 3 {
  const taken = new Set(aliveCitizensIn(positions, x, y).map(p => p.subPosition));
  for (const sp of [1, 2, 3] as const) {
    if (!taken.has(sp)) return sp;
  }
  return 3;
}
