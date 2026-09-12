import { SCARES_PER_NIGHT, getNeighbors } from '../board';
import { getValidKillTargets } from '../engine';
import type {
  CityMoveCommand,
  GameState,
  NightCommand,
  PendingQuestion
} from '../types';

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

/**
 * Жертва выбирается так, чтобы у мотива осталось больше возможностей на будущие
 * ночи, а при равенстве — подальше от машины детектива.
 */
export function chooseVictim(state: GameState): number | null {
  const targets = getValidKillTargets(state);
  if (targets.length === 0) return null;

  let best = targets[0];
  let bestScore = -Infinity;
  for (const id of targets) {
    const future = targetsAfterKill(state, id);
    const score = future * 10 + distanceToCar(state, id);
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
 * Правило: лжём, только если по этому признаку детектив ещё не получал ответа.
 * Иначе отвечаем так же, как уже отвечали, — два разных ответа на один вопрос
 * выдали бы лжеца с головой.
 */
export function decideAnswer(state: GameState, question: PendingQuestion): boolean {
  if (question.mustBeHonest) return question.truth;

  const previous = state.answers.find(
    a => a.attribute === question.attribute && a.value === question.value
  );
  if (previous) return previous.answer;

  // «Нет» на свой настоящий признак и «да» на чужой — оба ответа уводят от убийцы
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
