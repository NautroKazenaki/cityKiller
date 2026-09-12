import { SCARES_PER_NIGHT, getNeighbors } from '../board';
import { getValidKillTargets } from '../engine';
import { getMotive } from '../motives';
import type {
  Citizen,
  CityMoveCommand,
  GameState,
  NightCommand,
  PendingQuestion,
  QuestionAttribute
} from '../types';

const ATTRS: QuestionAttribute[] = ['sex', 'age', 'size', 'height'];

/**
 * Бот-убийца. Чистые функции над состоянием: сервер только вызывает их и
 * отправляет полученную команду через обычный applyCommand, так что бот
 * физически не может сходить против правил.
 */

function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** Сколько целей останется у мотива, если убить именно этого жителя */
function targetsAfterKill(state: GameState, victimId: number): number {
  const next = clone(state);
  const pos = next.positions.find(p => p.citizenId === victimId);
  if (!pos) return 0;
  pos.isDead = true;
  next.killsCount += 1;
  next.victims.push({
    citizenId: victimId,
    districtX: pos.districtX,
    districtY: pos.districtY,
    turnNumber: next.turnNumber
  });
  next.lastCrimeDistrict = { x: pos.districtX, y: pos.districtY };
  // после убийства машина детектива уезжает на место преступления
  next.detective = { x: pos.districtX, y: pos.districtY };
  return getValidKillTargets(next).length;
}

/** Расстояние в кварталах от жителя до полицейской машины */
function distanceToCar(state: GameState, citizenId: number): number {
  const pos = state.positions.find(p => p.citizenId === citizenId);
  if (!pos || !state.detective) return 99;
  return Math.abs(pos.districtX - state.detective.x) + Math.abs(pos.districtY - state.detective.y);
}

/** Расстояние между двумя жителями в кварталах */
function distanceBetween(state: GameState, aId: number, bId: number): number {
  const a = state.positions.find(p => p.citizenId === aId);
  const b = state.positions.find(p => p.citizenId === bId);
  if (!a || !b) return 0;
  return Math.abs(a.districtX - b.districtX) + Math.abs(a.districtY - b.districtY);
}

function isAlive(state: GameState, citizenId: number): boolean {
  const pos = state.positions.find(p => p.citizenId === citizenId);
  return pos !== undefined && !pos.isDead;
}

/**
 * Подставной житель — «легенда», за которую убийца выдаёт себя на допросах.
 * Берём максимально непохожего на себя: тогда любая ложь про свои признаки
 * складывается в портрет одного конкретного человека, а не в набор отговорок.
 * Выбор устойчив: пока подставной жив, он не меняется, а убийца его не трогает.
 */
export function chooseDecoy(state: GameState): Citizen | null {
  const killer = state.citizens.find(c => c.id === state.killer.citizenId);
  if (!killer) return null;

  let best: Citizen | null = null;
  let bestScore = -1;
  for (const c of state.citizens) {
    if (c.id === killer.id || !isAlive(state, c.id)) continue;
    const differences = ATTRS.filter(a => c[a] !== killer[a]).length;
    // при равенстве — меньший id, чтобы выбор не прыгал от хода к ходу
    if (differences > bestScore || (differences === bestScore && best && c.id < best.id)) {
      bestScore = differences;
      best = c;
    }
  }
  return best;
}

/**
 * Насколько убийство этой жертвы оставляет мотив неочевидным: сколько ещё мотивов
 * из списка кандидатов разрешали бы такой же ход. Чем больше — тем труднее
 * детективу вычеркнуть лишнее в своём списке.
 */
function motiveAmbiguity(state: GameState, victimId: number): number {
  const victim = state.citizens.find(c => c.id === victimId);
  const victimPosition = state.positions.find(p => p.citizenId === victimId);
  if (!victim || !victimPosition) return 0;

  return state.motiveOptions.filter(id => {
    const motive = getMotive(id);
    if (!motive) return false;
    return motive.canKill({ victim, victimPosition, state });
  }).length;
}

/**
 * Выбор жертвы. Учитываем четыре вещи сразу:
 * сохранить мотиву будущие цели, не выдать мотив, увести машину подальше от
 * собственного персонажа (она приедет на место преступления) и сберечь тех,
 * кто полезен живым — подставного жителя и группу-помощника.
 */
export function chooseVictim(state: GameState): number | null {
  const targets = getValidKillTargets(state);
  if (targets.length === 0) return null;

  const decoy = chooseDecoy(state);
  const allyGroup = state.killer.allyGroup;

  let best = targets[0];
  let bestScore = -Infinity;
  for (const id of targets) {
    const citizen = state.citizens.find(c => c.id === id)!;
    const future = targetsAfterKill(state, id);
    const ambiguity = motiveAmbiguity(state, id);
    // машина детектива уедет на место преступления — уводим её от себя
    const awayFromMe = distanceBetween(state, id, state.killer.citizenId);

    let score = future * 8 + ambiguity * 6 + awayFromMe * 4 + distanceToCar(state, id);
    if (decoy && id === decoy.id) score -= 1000; // легенду не трогаем
    if (citizen.group === allyGroup) score -= 15; // помощники нужны живыми

    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/**
 * Пугаем тех, кого детектив может допросить прямо сейчас: жителей в квартале с
 * машиной и по соседству. Своего персонажа и группу-помощника бережём — через них
 * можно лгать, а запуганный житель на вопросы не отвечает.
 */
export function chooseScares(state: GameState, killId: number | null): number[] {
  const candidates = state.positions.filter(
    p => !p.isDead && !p.isScared && p.citizenId !== killId
  );
  const required = Math.min(SCARES_PER_NIGHT, candidates.length);
  if (required === 0) return [];

  const allyGroup = state.killer.allyGroup;

  const scored = candidates.map(p => {
    const citizen = state.citizens.find(c => c.id === p.citizenId)!;
    const isSelf = p.citizenId === state.killer.citizenId;
    const isAlly = citizen.group === allyGroup;
    const dist = distanceToCar(state, p.citizenId);

    // чем ближе к машине, тем опаснее житель: детектив доберётся до него первым
    let score = 100 - dist * 20;
    // себя и помощников оставляем «говорящими» — их ответами можно управлять
    if (isSelf) score -= 60;
    else if (isAlly) score -= 40;
    return { id: p.citizenId, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, required).map(s => s.id);
}

export function decideNight(state: GameState): NightCommand {
  const killId = chooseVictim(state);
  return {
    type: 'killer:night',
    scareIds: chooseScares(state, killId),
    killId
  };
}

/**
 * Ответ на допрос. За обычного жителя движок всё равно заставит сказать правду,
 * поэтому решение нужно только за себя и за группу-помощника.
 *
 * Лжём не наугад, а «в образ» подставного жителя: отвечаем так, будто убийца —
 * это он. Простое отрицание своих признаков выдаёт себя на признаках с тремя
 * значениями: на «убийце 20?» и «убийце 60?» пришлось бы ответить «да» дважды.
 * Легенда же даёт связный портрет, который не противоречит сам себе.
 */
export function decideAnswer(state: GameState, question: PendingQuestion): boolean {
  if (question.mustBeHonest) return question.truth;

  const decoy = chooseDecoy(state);
  if (decoy) return decoy[question.attribute] === question.value;

  // подставного не нашлось — хотя бы не подтверждаем правду о себе
  const previous = state.answers.find(
    a => a.attribute === question.attribute && a.value === question.value
  );
  if (previous) return previous.answer;
  return !question.truth;
}

/**
 * Фаза Города: уводим своих людей подальше от машины детектива.
 * Двигать никого не обязаны — если лучше остаться, бот остаётся.
 */
export function decideCityMove(state: GameState): CityMoveCommand {
  const moves: CityMoveCommand['moves'] = [];
  const city = state.city;
  if (!city || city.emptyGroupNotice || !state.detective) {
    return { type: 'city:moveGroup', moves };
  }

  const car = state.detective;
  const crimeScenes = state.victims.map(v => ({ x: v.districtX, y: v.districtY }));
  // считаем занятость районов с учётом уже запланированных переездов
  const occupancy = new Map<string, number>();
  for (const p of state.positions) {
    if (p.isDead) continue;
    const key = `${p.districtX},${p.districtY}`;
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
  }

  const group = state.citizens.filter(c => c.group === city.group).map(c => c.id);
  for (const id of group) {
    const pos = state.positions.find(p => p.citizenId === id);
    if (!pos || pos.isDead) continue;

    const here = Math.abs(pos.districtX - car.x) + Math.abs(pos.districtY - car.y);
    // уже далеко — нет смысла шевелиться
    if (here >= 3) continue;

    const options = getNeighbors(pos.districtX, pos.districtY).filter(n => {
      if (crimeScenes.some(c => c.x === n.x && c.y === n.y)) return false;
      if ((occupancy.get(`${n.x},${n.y}`) ?? 0) >= 3) return false;
      return true;
    });
    if (options.length === 0) continue;

    let best = options[0];
    let bestDist = -1;
    for (const o of options) {
      const dist = Math.abs(o.x - car.x) + Math.abs(o.y - car.y);
      if (dist > bestDist) {
        bestDist = dist;
        best = o;
      }
    }
    if (bestDist <= here) continue;

    moves.push({ citizenId: id, toX: best.x, toY: best.y });
    occupancy.set(`${pos.districtX},${pos.districtY}`, (occupancy.get(`${pos.districtX},${pos.districtY}`) ?? 1) - 1);
    occupancy.set(`${best.x},${best.y}`, (occupancy.get(`${best.x},${best.y}`) ?? 0) + 1);
  }

  return { type: 'city:moveGroup', moves };
}

/** Замена выпавшей пустой группы: берём самую многочисленную из живых */
export function chooseReplacementGroup(state: GameState): string | null {
  const empty = state.city?.emptyGroupNotice;
  if (!empty) return null;

  const counts = new Map<string, number>();
  for (const c of state.citizens) {
    if (c.group === empty) continue;
    const pos = state.positions.find(p => p.citizenId === c.id);
    if (!pos || pos.isDead) continue;
    counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [group, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = group;
    }
  }
  return best;
}
