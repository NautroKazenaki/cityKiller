import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MAX_CITIZENS_PER_DISTRICT,
  aliveCitizensIn,
  getNeighbors
} from '../board';
import { getMotive } from '../motives';
import type {
  Citizen,
  CitizenGroup,
  CitizenPosition,
  GameCommand,
  GameState,
  QuestionAttribute,
  QuestionValue,
  RelocateCommand
} from '../types';

/**
 * Бот-детектив. Чистые функции над состоянием, как и бот-убийца: сервер
 * отправляет решения через обычный applyCommand, так что сходить против
 * правил бот не может.
 *
 * Логика — перебор гипотез «кто убийца × какая группа ему помогает».
 * Движок гарантирует, что обычный житель отвечает честно, значит гипотеза
 * жива, пока каждый ответ от «не лжеца» совпадает с признаками её убийцы.
 * Лжец (сам убийца и его помощники) может сказать что угодно — его ответы
 * гипотезу не опровергают. Больше ничего бот не предполагает, поэтому
 * настоящий убийца из списка гипотез не выпадает никогда.
 */

type District = { x: number; y: number };

export interface Hypothesis {
  killerId: number;
  allyGroup: CitizenGroup;
}

const QUESTIONS: Array<{ attribute: QuestionAttribute; value: QuestionValue }> = [
  { attribute: 'sex', value: 'male' },
  { attribute: 'age', value: 20 },
  { attribute: 'age', value: 40 },
  { attribute: 'age', value: 60 },
  { attribute: 'size', value: 'S' },
  { attribute: 'size', value: 'M' },
  { attribute: 'size', value: 'L' },
  { attribute: 'height', value: 'small' },
  { attribute: 'height', value: 'medium' },
  { attribute: 'height', value: 'large' }
];

/**
 * Проверка мотива по одному прошлому убийству. Большинство мотивов проверяются
 * своим же предикатом на восстановленном состоянии; у трёх нужны факты,
 * которых в нынешнем состоянии уже нет. null — проверить нечем (старое сохранение).
 */
function motiveAllowedThen(
  id: string,
  victim: Citizen,
  victimPosition: CitizenPosition,
  record: { carAt?: { x: number; y: number } | null; populationAtKill?: number },
  then: GameState
): boolean | null {
  const motive = getMotive(id);
  if (!motive) return false;
  switch (id) {
    case 'vigilante':
      if (record.carAt === undefined) return null;
      return motive.canKill({ victim, victimPosition, state: { ...then, detective: record.carAt } });
    case 'hitman':
      return record.populationAtKill === undefined ? null : record.populationAtKill === 1;
    case 'radical': {
      // необходимое условие: самой частой группе хватит оставшихся убийств до трёх.
      // Предикат движка строже (учитывает, кто ещё жив), так что настоящий мотив не отсечём
      const counts = new Map<string, number>();
      for (const v of then.victims) {
        const c = citizenOf(then, v.citizenId);
        if (c) counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
      }
      counts.set(victim.group, (counts.get(victim.group) ?? 0) + 1);
      const remaining = Math.max(0, 5 - then.killsCount - 1);
      return Math.max(...counts.values()) + remaining >= 3;
    }
    default:
      return motive.canKill({ victim, victimPosition, state: then });
  }
}

function citizenOf(state: GameState, id: number): Citizen | undefined {
  return state.citizens.find(c => c.id === id);
}

function positionOf(state: GameState, id: number): CitizenPosition | undefined {
  return state.positions.find(p => p.citizenId === id);
}

function isAlive(state: GameState, id: number): boolean {
  const p = positionOf(state, id);
  return !!p && !p.isDead;
}

function same(a: District, b: District): boolean {
  return a.x === b.x && a.y === b.y;
}

function distance(a: District, b: District): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function allDistricts(): District[] {
  const list: District[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) for (let x = 0; x < BOARD_WIDTH; x++) list.push({ x, y });
  return list;
}

function canLie(h: Hypothesis, citizen: Citizen): boolean {
  return citizen.id === h.killerId || citizen.group === h.allyGroup;
}

// ==== дедукция ====

export function consistentHypotheses(state: GameState): Hypothesis[] {
  // «мог убить X» — честный ответ: себя убить нельзя, значит X не убийца
  const cleared = new Set(state.policeAnswers.filter(a => a.canKill).map(a => a.citizenId));
  const groups = [...new Set(state.citizens.map(c => c.group))];
  const result: Hypothesis[] = [];
  for (const killer of state.citizens) {
    if (!isAlive(state, killer.id) || cleared.has(killer.id)) continue;
    for (const allyGroup of groups) {
      // помощников выбирают среди групп, где есть кто-то кроме самого убийцы
      if (!state.citizens.some(c => c.group === allyGroup && c.id !== killer.id)) continue;
      const h = { killerId: killer.id, allyGroup };
      const fits = state.answers.every(a => {
        const who = citizenOf(state, a.citizenId);
        if (!who || canLie(h, who)) return true;
        return a.answer === (killer[a.attribute] === a.value);
      });
      if (fits) result.push(h);
    }
  }
  return result;
}

/**
 * Вес гипотезы. Отсечь её может только ответ честного жителя; ответ того, кто
 * при этой гипотезе вправе лгать, её не опровергает — но и не поддерживает:
 * он мог сказать что угодно. Каждый такой ответ делит вес пополам. Без веса
 * любой житель оставался бы подозреваемым через гипотезу «допрошенный — его
 * помощник», и ни один вопрос не сужал бы круг.
 */
function hypothesisWeight(state: GameState, h: Hypothesis): number {
  let liars = 0;
  for (const a of state.answers) {
    const who = citizenOf(state, a.citizenId);
    if (who && canLie(h, who)) liars++;
  }
  return Math.pow(0.5, liars);
}

export interface WeightedHypotheses {
  hs: Hypothesis[];
  ws: number[];
}

export function weighHypotheses(state: GameState): WeightedHypotheses {
  const hs = consistentHypotheses(state);
  return { hs, ws: hs.map(h => hypothesisWeight(state, h)) };
}

/** Вероятность того, что убийца — этот житель */
export function killerMarginal({ hs, ws }: WeightedHypotheses): Map<number, number> {
  const mass = new Map<number, number>();
  hs.forEach((h, i) => mass.set(h.killerId, (mass.get(h.killerId) ?? 0) + ws[i]));
  const total = [...mass.values()].reduce((s, w) => s + w, 0) || 1;
  for (const [id, w] of mass) mass.set(id, w / total);
  return mass;
}

function distinctKillers(hs: Hypothesis[]): number {
  return new Set(hs.map(h => h.killerId)).size;
}

/** Неопределённость «кто убийца» в битах */
function entropy(mass: Map<number, number>): number {
  const total = [...mass.values()].reduce((s, w) => s + w, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const w of mass.values()) {
    if (w <= 0) continue;
    const p = w / total;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Сколько неопределённости останется после вопроса в среднем. Честный житель
 * отвечает по признакам убийцы гипотезы; тот, кто может лгать, — любым из двух
 * ответов с равной вероятностью.
 */
function expectedEntropy(
  state: GameState,
  wh: WeightedHypotheses,
  citizenId: number,
  attribute: QuestionAttribute,
  value: QuestionValue
): number {
  const asked = citizenOf(state, citizenId);
  const yes = new Map<number, number>();
  const no = new Map<number, number>();
  let pYes = 0;
  let pNo = 0;
  const add = (m: Map<number, number>, id: number, w: number) => m.set(id, (m.get(id) ?? 0) + w);
  wh.hs.forEach((h, i) => {
    const w = wh.ws[i];
    if (!asked || canLie(h, asked)) {
      add(yes, h.killerId, w / 2);
      add(no, h.killerId, w / 2);
      pYes += w / 2;
      pNo += w / 2;
      return;
    }
    const killer = citizenOf(state, h.killerId)!;
    if (killer[attribute] === value) {
      add(yes, h.killerId, w);
      pYes += w;
    } else {
      add(no, h.killerId, w);
      pNo += w;
    }
  });
  const total = pYes + pNo || 1;
  return (pYes / total) * entropy(yes) + (pNo / total) * entropy(no);
}

interface QuestionPick {
  citizenId: number;
  attribute: QuestionAttribute;
  value: QuestionValue;
  gain: number;
}

function bestQuestionFor(state: GameState, wh: WeightedHypotheses, citizenId: number): QuestionPick | null {
  const before = entropy(killerMarginal(wh));
  let best: QuestionPick | null = null;
  for (const q of QUESTIONS) {
    const gain = before - expectedEntropy(state, wh, citizenId, q.attribute, q.value);
    if (!best || gain > best.gain) best = { citizenId, ...q, gain };
  }
  return best;
}

/** Живые незапуганные жители района, которых ещё можно спросить */
function askableIn(state: GameState, d: District, exclude: number[] = []): number[] {
  return aliveCitizensIn(state.positions, d.x, d.y)
    .filter(p => !p.isScared && !exclude.includes(p.citizenId))
    .map(p => p.citizenId);
}

function bestQuestionAmong(state: GameState, wh: WeightedHypotheses, ids: number[]): QuestionPick | null {
  let best: QuestionPick | null = null;
  for (const id of ids) {
    const pick = bestQuestionFor(state, wh, id);
    if (pick && (!best || pick.gain > best.gain)) best = pick;
  }
  return best;
}

/** Ценность района: сумма лучших вопросов к его жителям на оставшиеся действия */
function districtValue(
  state: GameState,
  wh: WeightedHypotheses,
  d: District,
  abilities: number,
  exclude: number[]
): number {
  const gains = askableIn(state, d, exclude)
    .map(id => bestQuestionFor(state, wh, id)?.gain ?? 0)
    .sort((a, b) => b - a);
  return gains.slice(0, abilities).reduce((s, g) => s + g, 0);
}

// ==== мотив ====

export interface MotiveScore {
  id: string;
  /** Не противоречит ни одному из совершённых убийств */
  consistent: boolean;
  /**
   * Правдоподобие картины убийств: убийца выбирает среди разрешённых мотивом,
   * поэтому чем уже мотив и чем точнее жертвы в него укладываются, тем выше.
   */
  logLikelihood: number;
}

export function motiveScores(state: GameState): MotiveScore[] {
  // вероятности подозреваемых считаем лениво: нужны только для ответов «не мог»
  let mass: Map<number, number> | undefined;
  return state.motiveOptions.map(id => {
    if (!getMotive(id)) return { id, consistent: false, logLikelihood: -Infinity };
    let consistent = true;
    let logLikelihood = 0;

    state.victims.forEach((v, i) => {
      const before = state.victims.slice(0, i);
      const then: GameState = {
        ...state,
        victims: before,
        killsCount: i,
        lastCrimeDistrict: i > 0 ? { x: before[i - 1].districtX, y: before[i - 1].districtY } : null,
        detective: v.carAt ?? null
      };
      const victim = citizenOf(state, v.citizenId);
      if (!victim) return;
      const victimPosition: CitizenPosition = {
        citizenId: v.citizenId,
        districtX: v.districtX,
        districtY: v.districtY,
        subPosition: 1,
        isScared: v.wasScared,
        isDead: false
      };
      const verdict = motiveAllowedThen(id, victim, victimPosition, v, then);
      if (verdict === false) consistent = false;

      // кто был жив на момент убийства и кого мотив разрешал; положения — нынешние,
      // это приближение. Чем уже круг разрешённых, тем весомее совпадение
      const pool = state.citizens.filter(c => !before.some(b => b.citizenId === c.id));
      const allowed =
        verdict === null
          ? pool.length
          : pool.filter(c => {
              const pos =
                c.id === v.citizenId
                  ? victimPosition
                  : { ...(positionOf(state, c.id) ?? victimPosition), isDead: false };
              const record =
                c.id === v.citizenId
                  ? v
                  : {
                      carAt: v.carAt,
                      populationAtKill: aliveCitizensIn(state.positions, pos.districtX, pos.districtY).length
                    };
              return motiveAllowedThen(id, c, pos, record, then) !== false;
            }).length;
      logLikelihood -= Math.log(Math.max(1, allowed));
    });

    // Ответы по жетонам — честные. «Мог убить X» значит, что мотив X разрешал: иначе
    // ответ был бы «нет». «Не мог» мотив не опровергает — X мог оказаться самим
    // убийцей, — но делает менее вероятным ровно на эту вероятность
    for (const a of state.policeAnswers) {
      const ctx = a.context;
      const x = citizenOf(state, a.citizenId);
      if (!ctx || !x) continue;
      const inCarDistrict = !!ctx.carAt && ctx.carAt.x === ctx.districtX && ctx.carAt.y === ctx.districtY;
      if (inCarDistrict) continue; // там ответ всегда «нет», мотив ни при чём
      const prefix = state.victims.slice(0, ctx.victimsCount);
      const last = prefix[prefix.length - 1];
      const then: GameState = {
        ...state,
        victims: prefix,
        killsCount: prefix.length,
        lastCrimeDistrict: last ? { x: last.districtX, y: last.districtY } : null,
        detective: ctx.carAt
      };
      const pos: CitizenPosition = {
        citizenId: x.id,
        districtX: ctx.districtX,
        districtY: ctx.districtY,
        subPosition: 1,
        isScared: ctx.isScared,
        isDead: false
      };
      const allowed = motiveAllowedThen(id, x, pos, { carAt: ctx.carAt, populationAtKill: ctx.population }, then);
      if (a.canKill) {
        if (allowed === false) consistent = false;
      } else if (allowed === true) {
        logLikelihood += Math.log(Math.max(0.02, killerProbability(x.id)));
      }
    }

    return { id, consistent, logLikelihood };
  });

  function killerProbability(citizenId: number): number {
    mass ??= killerMarginal(weighHypotheses(state));
    return mass.get(citizenId) ?? 0;
  }
}

/** Разрешает ли мотив убить этого жителя прямо сейчас — для выбора, на кого положить жетон */
function motiveAllowsNow(state: GameState, id: string, citizenId: number): boolean | null {
  const c = citizenOf(state, citizenId);
  const pos = positionOf(state, citizenId);
  if (!c || !pos) return null;
  return motiveAllowedThen(
    id,
    c,
    pos,
    {
      carAt: state.detective,
      populationAtKill: aliveCitizensIn(state.positions, pos.districtX, pos.districtY).length
    },
    state
  );
}

export function bestMotive(state: GameState): string {
  const scores = motiveScores(state);
  const pool = scores.some(s => s.consistent) ? scores.filter(s => s.consistent) : scores;
  return pool.reduce((best, s) => (s.logLikelihood > best.logLikelihood ? s : best), pool[0]).id;
}

export function chooseAccusation(state: GameState): { job: string; motiveId: string } {
  const wh = weighHypotheses(state);
  const mass = killerMarginal(wh);
  let killerId = wh.hs[0]?.killerId ?? state.citizens.find(c => isAlive(state, c.id))!.id;
  let top = -1;
  for (const [id, w] of mass) {
    if (w > top) {
      top = w;
      killerId = id;
    }
  }
  return { job: citizenOf(state, killerId)!.job, motiveId: bestMotive(state) };
}

/**
 * Досрочное обвинение — только при полной уверенности: один подозреваемый и
 * один мотив, который проверяется по фактам. Иначе ждать выгоднее: через
 * шесть раундов без пятого убийства детектив побеждает сам.
 */
function certainAccusation(state: GameState, hs: Hypothesis[]): boolean {
  if (distinctKillers(hs) !== 1) return false;
  // без записанных фактов мотив неотличим — досрочно не рискуем
  if (state.victims.some(v => v.carAt === undefined || v.populationAtKill === undefined)) return false;
  return motiveScores(state).filter(s => s.consistent).length === 1;
}

// ==== ходы по фазам ====

function placeCar(state: GameState): GameCommand {
  let best = { x: 1, y: 1 };
  let bestCount = -1;
  for (const d of allDistricts()) {
    const count = [d, ...getNeighbors(d.x, d.y)].reduce(
      (s, n) => s + aliveCitizensIn(state.positions, n.x, n.y).length,
      0
    );
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return { type: 'detective:placeCar', x: best.x, y: best.y };
}

export function decideRelocation(state: GameState): RelocateCommand {
  const crime = state.lastCrimeDistrict!;
  const stranded = aliveCitizensIn(state.positions, crime.x, crime.y);
  const neighbors = getNeighbors(crime.x, crime.y);
  const allFull = neighbors.every(
    n => aliveCitizensIn(state.positions, n.x, n.y).length >= MAX_CITIZENS_PER_DISTRICT
  );
  const pool = (allFull ? allDistricts() : neighbors).filter(d => !same(d, crime));
  const room = new Map(
    pool.map(d => [`${d.x},${d.y}`, MAX_CITIZENS_PER_DISTRICT - aliveCitizensIn(state.positions, d.x, d.y).length])
  );
  const moves = stranded.map(p => {
    const target = pool.find(d => (room.get(`${d.x},${d.y}`) ?? 0) > 0) ?? pool[0];
    room.set(`${target.x},${target.y}`, (room.get(`${target.x},${target.y}`) ?? 0) - 1);
    return { citizenId: p.citizenId, toX: target.x, toY: target.y };
  });
  return { type: 'detective:relocate', moves };
}

function liveTokenQuestion(state: GameState): GameCommand | null {
  const token = state.policeTokens.find(t => isAlive(state, t.citizenId));
  return token ? { type: 'detective:policeQuestion', citizenId: token.citizenId } : null;
}

function decideDay(state: GameState): GameCommand {
  const endTurn: GameCommand = { type: 'detective:endTurn' };
  const tokenQuestion = liveTokenQuestion(state);
  if (tokenQuestion) return tokenQuestion;

  const wh = weighHypotheses(state);
  const hs = wh.hs;
  if (certainAccusation(state, hs)) return { type: 'detective:accuse', ...chooseAccusation(state) };
  // убийца уже вычислен — вопросы о признаках больше ничего не дадут, ждём фактов о мотиве
  if (distinctKillers(hs) <= 1 || !state.detective) return endTurn;

  const car = state.detective;
  const turn = state.turn;
  const canAskHere =
    turn.abilitiesLeft > 0 && (!turn.questionedDistrict || same(turn.questionedDistrict, car));
  const hereValue = canAskHere
    ? districtValue(state, wh, car, turn.abilitiesLeft, turn.questionedCitizenIds)
    : 0;

  // пока мотив не ясен, участок ценен сам по себе: жетон проверяет мотивы честно
  const motiveOpen = motiveScores(state).filter(s => s.consistent).length > 1;
  const policeBonus = (d: District) =>
    motiveOpen &&
    state.buildings.some(
      b => b.type === 'police' && b.districtX === d.x && b.districtY === d.y && !turn.usedBuildingIds.includes(b.id)
    )
      ? 0.3
      : 0;

  // ехать стоит, пока в этот ход ещё никого не спрашивали: допрос держит машину в одном районе
  if (turn.movesLeft > 0 && turn.abilitiesLeft > 0 && !turn.questionedDistrict) {
    let target: District | null = null;
    let targetValue = hereValue + policeBonus(car);
    for (const d of allDistricts()) {
      const dist = distance(car, d);
      if (dist === 0 || dist > turn.movesLeft) continue;
      const value = districtValue(state, wh, d, turn.abilitiesLeft, []) + policeBonus(d) - dist * 0.01;
      if (value > targetValue + 0.05) {
        targetValue = value;
        target = d;
      }
    }
    if (target) {
      const step = getNeighbors(car.x, car.y).find(n => distance(n, target!) === distance(car, target!) - 1)!;
      return { type: 'detective:move', x: step.x, y: step.y };
    }
  }

  if (canAskHere) {
    const pick = bestQuestionAmong(state, wh, askableIn(state, car, turn.questionedCitizenIds));
    if (pick && pick.gain > 0.01) {
      return {
        type: 'detective:question',
        citizenId: pick.citizenId,
        attribute: pick.attribute,
        value: pick.value
      };
    }
  }

  const building = state.buildings.find(b => b.districtX === car.x && b.districtY === car.y);
  if (building && turn.abilitiesLeft > 0 && !turn.usedBuildingIds.includes(building.id)) {
    const nearby = getNeighbors(car.x, car.y);
    if (building.type === 'diner') {
      const pick = bestQuestionAmong(
        state,
        wh,
        nearby.flatMap(n => askableIn(state, n))
      );
      if (pick && pick.gain > 0.01) {
        return {
          type: 'detective:useBuilding',
          buildingId: building.id,
          payload: { kind: 'diner', citizenId: pick.citizenId, attribute: pick.attribute, value: pick.value }
        };
      }
    }
    if (building.type === 'police') {
      // Жетон туда, где ответ скажет больше всего: «мог убить» оправдывает
      // подозреваемого и отсекает мотивы, которые запрещали эту жертву. В районе
      // машины ответ всегда «нет» — туда класть бессмысленно
      const weights = killerMarginal(wh);
      const openMotives = motiveScores(state)
        .filter(s => s.consistent)
        .map(s => s.id);
      const score = (id: number) => {
        let allow = 0;
        for (const m of openMotives) if (motiveAllowsNow(state, m, id) !== false) allow++;
        const split = Math.min(allow, openMotives.length - allow) / Math.max(1, openMotives.length);
        return (weights.get(id) ?? 0) + split;
      };
      const suspect = nearby
        .flatMap(d => aliveCitizensIn(state.positions, d.x, d.y))
        .map(p => p.citizenId)
        .filter(id => !state.policeTokens.some(t => t.citizenId === id))
        .map(id => ({ id, s: score(id) }))
        .filter(x => x.s > 0.05)
        .sort((a, b) => b.s - a.s)[0]?.id;
      if (suspect !== undefined) {
        return {
          type: 'detective:useBuilding',
          buildingId: building.id,
          payload: { kind: 'police', citizenId: suspect }
        };
      }
    }
  }

  return endTurn;
}

function mostPopulatedGroup(state: GameState, except: CitizenGroup): CitizenGroup | null {
  const counts = new Map<CitizenGroup, number>();
  for (const c of state.citizens) {
    if (c.group === except || !isAlive(state, c.id)) continue;
    counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
  }
  let best: CitizenGroup | null = null;
  let bestCount = 0;
  for (const [g, n] of counts) {
    if (n > bestCount) {
      bestCount = n;
      best = g;
    }
  }
  return best;
}

/** Ход бота-детектива; null — сейчас ходит убийца или ждём его ответа */
export function decideDetective(state: GameState): GameCommand | null {
  switch (state.phase) {
    case 'setup':
      return placeCar(state);
    case 'relocation':
      return decideRelocation(state);
    case 'day':
      return state.pendingQuestion ? null : decideDay(state);
    case 'accusation':
      // приговор после пятого убийства — но сначала выжать оставшиеся жетоны
      return liveTokenQuestion(state) ?? { type: 'detective:accuse', ...chooseAccusation(state) };
    case 'city': {
      if (!state.city || state.city.stage !== 'detective') return null;
      if (state.city.emptyGroupNotice) {
        const group = mostPopulatedGroup(state, state.city.emptyGroupNotice);
        return group ? { type: 'city:chooseGroup', group } : null;
      }
      return { type: 'city:moveGroup', moves: [] };
    }
    default:
      return null;
  }
}
