import { BOARD_HEIGHT, BOARD_WIDTH, SCARES_PER_NIGHT } from '../board';
import { getValidKillTargets } from '../engine';
import { getMotive } from '../motives';
import type {
  Citizen,
  CitizenGroup,
  CityMoveCommand,
  GameState,
  NightCommand,
  PendingQuestion,
  QuestionAttribute
} from '../types';
import { enumerateGroupMoves, positionsAfter } from './common';
import { citizenQuestionGain, weighHypotheses } from './detective';

const ATTRS: QuestionAttribute[] = ['sex', 'age', 'size', 'height'];

/**
 * Бот-убийца. Чистые функции над состоянием: сервер только вызывает их и
 * отправляет полученную команду через обычный applyCommand, так что бот
 * физически не может сходить против правил.
 *
 * Ночью он смотрит на партию глазами детектива: у нас есть модель, которая
 * рассуждает только по открытым данным (бот-детектив), и убийца прогоняет её
 * у себя — сколько правды детектив вытянет завтра, если начнёт день с места
 * этого преступления. Жертва и испуги подбираются так, чтобы вытянуть было
 * нечего: свидетели запуганы, участки далеко, рядом только свои лжецы.
 */

type District = { x: number; y: number };

/** Веса оценки хода. Подобраны партиями бот против бота */
const W = {
  /** за каждый бит правды, который детектив сможет вытянуть завтра */
  threat: 20,
  /** участок в пределах дня пути от места преступления: жетон честно проверит мотив */
  police: 6,
  /** свой лжец рядом с местом преступления: его спросят — он соврёт */
  liarNear: 2,
  /** жертвы в пределах этого отставания от лучшей считаются равными — выбор случайный */
  margin: 2,
  /** доля ночей с блефом испугом и убийством своего помощника */
  bluffScare: 0.12,
  bluffKill: 0.08
};

function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function positionOf(state: GameState, id: number) {
  return state.positions.find(p => p.citizenId === id);
}

function distance(a: District, b: District): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function districtsWithin(from: District, radius: number): District[] {
  const list: District[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (distance(from, { x, y }) <= radius) list.push({ x, y });
    }
  }
  return list;
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
    turnNumber: next.turnNumber,
    wasScared: pos.isScared,
    carAt: next.detective ? { ...next.detective } : null,
    populationAtKill: next.positions.filter(
      p => !p.isDead && p.districtX === pos.districtX && p.districtY === pos.districtY
    ).length + 1
  });
  next.lastCrimeDistrict = { x: pos.districtX, y: pos.districtY };
  // после убийства машина детектива уезжает на место преступления
  next.detective = { x: pos.districtX, y: pos.districtY };
  return getValidKillTargets(next).length;
}

/** Расстояние в кварталах от жителя до полицейской машины */
function distanceToCar(state: GameState, citizenId: number): number {
  const pos = positionOf(state, citizenId);
  if (!pos || !state.detective) return 99;
  return Math.abs(pos.districtX - state.detective.x) + Math.abs(pos.districtY - state.detective.y);
}

/** Расстояние между двумя жителями в кварталах */
function distanceBetween(state: GameState, aId: number, bId: number): number {
  const a = positionOf(state, aId);
  const b = positionOf(state, bId);
  if (!a || !b) return 0;
  return Math.abs(a.districtX - b.districtX) + Math.abs(a.districtY - b.districtY);
}

function isAlive(state: GameState, citizenId: number): boolean {
  const pos = positionOf(state, citizenId);
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
  const victimPosition = positionOf(state, victimId);
  if (!victim || !victimPosition) return 0;

  return state.motiveOptions.filter(id => {
    const motive = getMotive(id);
    if (!motive) return false;
    return motive.canKill({ victim, victimPosition, state });
  }).length;
}

// ==== взгляд детектива ====

interface DetectiveEyes {
  /** Сколько бит о личности убийцы даёт лучший вопрос к этому жителю — по модели детектива */
  gain: Map<number, number>;
  /** Кто может лгать: сам убийца и его помощники */
  liars: Set<number>;
  decoy: Citizen | null;
}

function detectiveEyes(state: GameState): DetectiveEyes {
  const wh = weighHypotheses(state);
  const gain = new Map<number, number>();
  for (const c of state.citizens) {
    if (isAlive(state, c.id)) gain.set(c.id, citizenQuestionGain(state, wh, c.id));
  }
  const liars = new Set(
    state.citizens
      .filter(c => c.id === state.killer.citizenId || c.group === state.killer.allyGroup)
      .map(c => c.id)
  );
  return { gain, liars, decoy: chooseDecoy(state) };
}

/**
 * Сколько правды детектив вытянет за день, начав его из from: лучший район в
 * пределах двух переездов и два вопроса к честным незапуганным жителям. Лжецов
 * не считаем — их ответ убийца подделает.
 */
function threatFrom(state: GameState, eyes: DetectiveEyes, from: District, silenced: Set<number>): number {
  let worst = 0;
  for (const d of districtsWithin(from, 2)) {
    const gains = state.positions
      .filter(
        p =>
          !p.isDead &&
          !p.isScared &&
          p.districtX === d.x &&
          p.districtY === d.y &&
          !silenced.has(p.citizenId) &&
          !eyes.liars.has(p.citizenId)
      )
      .map(p => eyes.gain.get(p.citizenId) ?? 0)
      .sort((a, b) => b - a);
    worst = Math.max(worst, (gains[0] ?? 0) + (gains[1] ?? 0));
  }
  return worst;
}

function policeNear(state: GameState, from: District): boolean {
  return state.buildings.some(
    b => b.type === 'police' && distance(from, { x: b.districtX, y: b.districtY }) <= 2
  );
}

function liarsNear(state: GameState, eyes: DetectiveEyes, from: District, silenced: Set<number>): number {
  return state.positions.filter(
    p =>
      !p.isDead &&
      !p.isScared &&
      eyes.liars.has(p.citizenId) &&
      !silenced.has(p.citizenId) &&
      distance(from, { x: p.districtX, y: p.districtY }) <= 1
  ).length;
}

// ==== ночь ====

/** Прежняя оценка жертвы: будущие цели, неочевидность мотива, машина подальше от себя */
function victimBaseScore(state: GameState, id: number, decoy: Citizen | null, spareAllies: boolean): number {
  const citizen = state.citizens.find(c => c.id === id)!;
  const future = targetsAfterKill(state, id);
  const ambiguity = motiveAmbiguity(state, id);
  // машина детектива уедет на место преступления — уводим её от себя
  const awayFromMe = distanceBetween(state, id, state.killer.citizenId);
  let score = future * 8 + ambiguity * 6 + awayFromMe * 4 + distanceToCar(state, id);
  if (decoy && id === decoy.id) score -= 1000; // легенду не трогаем
  if (spareAllies && citizen.group === state.killer.allyGroup) score -= 15; // помощники нужны живыми
  return score;
}

/**
 * Порядок, в котором пугать при прочих равных: ближних к месту, где детектив
 * начнёт день, — раньше; себя и помощников — в последнюю очередь, их ответами
 * можно управлять.
 */
function scareOrder(state: GameState, killId: number | null, from: District): number[] {
  const allyGroup = state.killer.allyGroup;
  return state.positions
    .filter(p => !p.isDead && !p.isScared && p.citizenId !== killId)
    .map(p => {
      const citizen = state.citizens.find(c => c.id === p.citizenId)!;
      let score = 100 - distance(from, { x: p.districtX, y: p.districtY }) * 20;
      if (p.citizenId === state.killer.citizenId) score -= 60;
      else if (citizen.group === allyGroup) score -= 40;
      return { id: p.citizenId, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(s => s.id);
}

/**
 * Испуги жадно: каждый следующий — тот, кто сильнее всего срезает угрозу.
 * Если срезать уже нечего, — по прежнему порядку. Себя не пугаем, пока есть кто-то ещё.
 */
function pickScares(
  state: GameState,
  eyes: DetectiveEyes,
  killId: number | null,
  from: District,
  bluff: boolean
): number[] {
  const order = scareOrder(state, killId, from);
  const required = Math.min(SCARES_PER_NIGHT, order.length);
  const self = state.killer.citizenId;
  const chosen: number[] = [];
  const silenced = new Set<number>(killId !== null ? [killId] : []);

  while (chosen.length < required) {
    let best: number | null = null;
    let bestThreat = Infinity;
    for (const id of order) {
      if (chosen.includes(id) || id === self) continue;
      const threat = threatFrom(state, eyes, from, new Set([...silenced, ...chosen, id]));
      if (threat < bestThreat - 1e-9) {
        bestThreat = threat;
        best = id;
      }
    }
    chosen.push(best ?? order.find(id => !chosen.includes(id))!);
  }

  // Блеф: изредка второй испуг — на своего же помощника рядом. Детектив, решивший,
  // что убийца бережёт своих, пойдёт по ложному следу
  if (bluff && chosen.length === 2) {
    const ally = order.find(
      id =>
        id !== self &&
        eyes.liars.has(id) &&
        !chosen.includes(id) &&
        distance(from, {
          x: positionOf(state, id)!.districtX,
          y: positionOf(state, id)!.districtY
        }) <= 2
    );
    if (ally !== undefined) chosen[1] = ally;
  }
  return chosen;
}

interface NightPlan {
  killId: number | null;
  scares: number[];
}

function planNight(state: GameState): NightPlan {
  const eyes = detectiveEyes(state);
  const targets = getValidKillTargets(state);
  const bluffScare = Math.random() < W.bluffScare;
  const bluffKill = Math.random() < W.bluffKill;

  if (targets.length === 0) {
    const from = state.detective ?? { x: 1, y: 1 };
    return { killId: null, scares: pickScares(state, eyes, null, from, bluffScare) };
  }

  const scored = targets.map(id => {
    const pos = positionOf(state, id)!;
    const from = { x: pos.districtX, y: pos.districtY };
    const scares = pickScares(state, eyes, id, from, false);
    const silenced = new Set([id, ...scares]);
    const score =
      victimBaseScore(state, id, eyes.decoy, !bluffKill) -
      threatFrom(state, eyes, from, silenced) * W.threat -
      (policeNear(state, from) ? W.police : 0) +
      liarsNear(state, eyes, from, silenced) * W.liarNear;
    return { id, from, scares, score };
  });

  const best = Math.max(...scored.map(s => s.score));
  // из почти равных — случайно: детерминированного бота быстро начинают читать
  const pool = scored.filter(s => s.score >= best - W.margin);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const scares = bluffScare ? pickScares(state, eyes, pick.id, pick.from, true) : pick.scares;
  return { killId: pick.id, scares };
}

/** Выбор жертвы (для тестов и отладки — та же оценка, что в ночном ходе) */
export function chooseVictim(state: GameState): number | null {
  return planNight(state).killId;
}

/** Испуги при уже выбранной жертве */
export function chooseScares(state: GameState, killId: number | null): number[] {
  const pos = killId !== null ? positionOf(state, killId) : undefined;
  const from = pos ? { x: pos.districtX, y: pos.districtY } : (state.detective ?? { x: 1, y: 1 });
  return pickScares(state, detectiveEyes(state), killId, from, false);
}

export function decideNight(state: GameState): NightCommand {
  const plan = planNight(state);
  return { type: 'killer:night', scareIds: plan.scares, killId: plan.killId };
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

// ==== фаза Города ====

/**
 * Перебираем все допустимые перемещения своей группы. Главное — чтобы у мотива
 * были законные цели следующей ночью (машина стоит, где стоит); дальше — свои
 * лжецы подальше от машины, куда детектив доедет первым делом.
 */
export function decideCityMove(state: GameState): CityMoveCommand {
  const city = state.city;
  const car = state.detective;
  if (!city || city.emptyGroupNotice || !car) return { type: 'city:moveGroup', moves: [] };

  const liars = new Set(
    state.citizens
      .filter(c => c.id === state.killer.citizenId || c.group === state.killer.allyGroup)
      .map(c => c.id)
  );

  let best: CityMoveCommand['moves'] = [];
  let bestScore = -Infinity;
  for (const moves of enumerateGroupMoves(state, city.group)) {
    const positions = positionsAfter(state, moves);
    const targets = getValidKillTargets({ ...state, positions }).length;
    let liarDistance = 0;
    for (const p of positions) {
      if (p.isDead || !liars.has(p.citizenId)) continue;
      liarDistance += Math.min(3, distance(car, { x: p.districtX, y: p.districtY }));
    }
    const score = (targets === 0 ? -50 : Math.min(targets, 8) * 2) + liarDistance * 0.5 - moves.length * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = moves;
    }
  }
  return { type: 'city:moveGroup', moves: best };
}

/**
 * Выбор группы-помощника из трёх предложенных: берём ту, где больше живых людей
 * (кроме себя). Каждый помощник — ещё один рот, которым можно солгать.
 */
export function chooseAllyGroup(state: GameState): CitizenGroup | null {
  const options = state.allyGroupOptions ?? [];
  let best: CitizenGroup | null = options[0] ?? null;
  let bestCount = -1;
  for (const group of options) {
    const count = state.citizens.filter(
      c => c.group === group && c.id !== state.killer.citizenId && isAlive(state, c.id)
    ).length;
    if (count > bestCount) {
      bestCount = count;
      best = group;
    }
  }
  return best;
}

/** Замена выпавшей пустой группы: берём самую многочисленную из живых */
export function chooseReplacementGroup(state: GameState): string | null {
  const empty = state.city?.emptyGroupNotice;
  if (!empty) return null;

  const counts = new Map<string, number>();
  for (const c of state.citizens) {
    if (c.group === empty) continue;
    const pos = positionOf(state, c.id);
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
