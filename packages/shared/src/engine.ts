import {
  KILLS_TO_WIN,
  MAX_CITIZENS_PER_DISTRICT,
  SCARES_PER_NIGHT,
  aliveCitizensIn,
  areNeighbors,
  isInsideBoard,
  isSameDistrict,
  nextSubPosition
} from './board';
import { getMotive } from './motives';
import {
  AccuseCommand,
  AnswerCommand,
  Citizen,
  CitizenPosition,
  GameCommand,
  GameState,
  MoveCommand,
  NightCommand,
  PlaceCarCommand,
  PlayerRole,
  PoliceQuestionCommand,
  QuestionAttribute,
  QuestionCommand,
  QuestionValue,
  RelocateCommand,
  UseBuildingCommand
} from './types';

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

function fail(error: string): ApplyResult {
  return { ok: false, error };
}

/** Состояние — плоские JSON-данные, поэтому клонирование через JSON безопасно */
function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function log(state: GameState, role: PlayerRole | 'system', message: string): void {
  state.log.push({
    seq: state.log.length,
    turnNumber: state.turnNumber,
    role,
    message
  });
}

function getCitizen(state: GameState, id: number): Citizen | undefined {
  return state.citizens.find(c => c.id === id);
}

function getPosition(state: GameState, id: number): CitizenPosition | undefined {
  return state.positions.find(p => p.citizenId === id);
}

function citizenName(state: GameState, id: number): string {
  return getCitizen(state, id)?.job ?? `#${id}`;
}

function resetTurn(state: GameState): void {
  state.turn = {
    movesLeft: 2,
    abilitiesLeft: 2,
    questionedDistrict: null,
    usedBuildingIds: []
  };
}

const VALID_VALUES: Record<QuestionAttribute, QuestionValue[]> = {
  sex: ['male', 'female'],
  age: [20, 40, 60],
  size: ['S', 'M', 'L'],
  height: ['small', 'medium', 'large']
};

function isValidQuestion(attribute: QuestionAttribute, value: QuestionValue): boolean {
  return VALID_VALUES[attribute]?.includes(value) ?? false;
}

function questionTruth(state: GameState, attribute: QuestionAttribute, value: QuestionValue): boolean {
  const killer = getCitizen(state, state.killer.citizenId)!;
  return killer[attribute] === value;
}

/** Может ли убийца убить этого жителя прямо сейчас (все правила + мотив) */
export function canKillNow(state: GameState, victimId: number): boolean {
  const victim = getCitizen(state, victimId);
  const victimPosition = getPosition(state, victimId);
  if (!victim || !victimPosition) return false;
  if (victimPosition.isDead) return false;
  // Нельзя убить себя
  if (victimId === state.killer.citizenId) return false;
  // Нельзя убивать там, где стоит полицейская машина
  if (
    state.detective &&
    victimPosition.districtX === state.detective.x &&
    victimPosition.districtY === state.detective.y
  ) {
    return false;
  }
  // Нельзя нарушать собственный мотив
  const motive = getMotive(state.killer.motiveId);
  if (!motive) return false;
  return motive.canKill({ victim, victimPosition, state });
}

export function getValidKillTargets(state: GameState): number[] {
  return state.citizens.filter(c => canKillNow(state, c.id)).map(c => c.id);
}

/** Проверка лимита жителей по всем районам после гипотетического набора перемещений */
function validateOccupancy(positions: CitizenPosition[]): boolean {
  const counts = new Map<string, number>();
  for (const p of positions) {
    if (p.isDead) continue;
    const key = `${p.districtX},${p.districtY}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].every(n => n <= MAX_CITIZENS_PER_DISTRICT);
}

function applyPlaceCar(state: GameState, cmd: PlaceCarCommand): ApplyResult {
  if (!isInsideBoard(cmd.x, cmd.y)) return fail('Район вне карты');
  state.detective = { x: cmd.x, y: cmd.y };
  state.phase = 'night';
  log(state, 'detective', `Детектив поставил машину в район (${cmd.x},${cmd.y}). Наступает ночь.`);
  return { ok: true, state };
}

function applyNight(state: GameState, cmd: NightCommand): ApplyResult {
  // --- Испуг ---
  const scareCandidates = state.positions.filter(
    p => !p.isDead && !p.isScared && p.citizenId !== cmd.killId
  );
  const requiredScares = Math.min(SCARES_PER_NIGHT, scareCandidates.length);
  const uniqueScares = [...new Set(cmd.scareIds)];
  if (uniqueScares.length !== requiredScares) {
    return fail(`Этой ночью нужно запугать ровно ${requiredScares} жителей`);
  }
  for (const id of uniqueScares) {
    const pos = getPosition(state, id);
    if (!pos || pos.isDead) return fail(`Житель ${citizenName(state, id)} не может быть запуган`);
    if (pos.isScared) return fail(`${citizenName(state, id)} уже запуган`);
    if (id === cmd.killId) return fail('Нельзя запугать жертву убийства');
  }

  // --- Убийство ---
  const validTargets = getValidKillTargets(state);
  if (cmd.killId === null) {
    if (validTargets.length > 0) {
      return fail('Есть доступные жертвы — пропустить убийство нельзя');
    }
  } else if (!validTargets.includes(cmd.killId)) {
    return fail('Эту жертву убить нельзя: правила или мотив запрещают');
  }

  for (const id of uniqueScares) {
    getPosition(state, id)!.isScared = true;
  }

  state.lastNight = { scaredIds: uniqueScares, killedId: cmd.killId };

  if (cmd.killId === null) {
    log(state, 'killer', 'Ночью никто не был убит: у убийцы не было доступных жертв.');
    state.phase = 'day';
    resetTurn(state);
    return { ok: true, state };
  }

  const victimPos = getPosition(state, cmd.killId)!;
  victimPos.isDead = true;
  victimPos.isScared = false;
  state.killsCount += 1;
  state.victims.push({
    citizenId: cmd.killId,
    districtX: victimPos.districtX,
    districtY: victimPos.districtY,
    turnNumber: state.turnNumber
  });
  state.lastCrimeDistrict = { x: victimPos.districtX, y: victimPos.districtY };
  // Машина детектива перемещается на место преступления
  state.detective = { x: victimPos.districtX, y: victimPos.districtY };
  // Жетон полиции с убитого снимается
  state.policeTokens = state.policeTokens.filter(t => t.citizenId !== cmd.killId);

  log(
    state,
    'killer',
    `Ночь ${state.turnNumber}: убит ${citizenName(state, cmd.killId)} в районе (${victimPos.districtX},${victimPos.districtY}). Всего убийств: ${state.killsCount}.`
  );

  if (state.killsCount >= KILLS_TO_WIN) {
    state.phase = 'accusation';
    log(state, 'system', 'Пятое убийство! Детектив обязан немедленно назвать профессию убийцы и его мотив.');
    return { ok: true, state };
  }

  const remaining = aliveCitizensIn(state.positions, victimPos.districtX, victimPos.districtY);
  if (remaining.length > 0) {
    state.phase = 'relocation';
    log(state, 'system', 'Детектив расселяет жителей с места преступления в соседние районы.');
  } else {
    state.phase = 'day';
    resetTurn(state);
  }
  return { ok: true, state };
}

function applyRelocate(state: GameState, cmd: RelocateCommand): ApplyResult {
  const crime = state.lastCrimeDistrict;
  if (!crime) return fail('Нет места преступления');

  const mustMove = aliveCitizensIn(state.positions, crime.x, crime.y).map(p => p.citizenId);
  const movedIds = cmd.moves.map(m => m.citizenId);
  if (
    mustMove.length !== movedIds.length ||
    !mustMove.every(id => movedIds.includes(id))
  ) {
    return fail('Нужно переместить всех живых жителей с места преступления');
  }

  for (const move of cmd.moves) {
    if (!isInsideBoard(move.toX, move.toY)) return fail('Район вне карты');
    if (!areNeighbors(crime.x, crime.y, move.toX, move.toY)) {
      return fail('Жителей можно расселять только в соседние районы');
    }
  }

  const updated = state.positions.map(p => {
    const move = cmd.moves.find(m => m.citizenId === p.citizenId);
    return move ? { ...p, districtX: move.toX, districtY: move.toY } : { ...p };
  });
  if (!validateOccupancy(updated)) {
    return fail(`В районе не может быть больше ${MAX_CITIZENS_PER_DISTRICT} жителей`);
  }

  for (const move of cmd.moves) {
    const pos = getPosition(state, move.citizenId)!;
    pos.districtX = move.toX;
    pos.districtY = move.toY;
    pos.subPosition = nextSubPosition(state.positions, move.toX, move.toY);
  }

  state.phase = 'day';
  resetTurn(state);
  log(state, 'detective', 'Жители расселены с места преступления. Начинается день.');
  return { ok: true, state };
}

function applyMove(state: GameState, cmd: MoveCommand): ApplyResult {
  if (state.turn.movesLeft <= 0) return fail('Перемещения на этот ход закончились');
  if (!state.detective) return fail('Машина ещё не поставлена');
  if (!isInsideBoard(cmd.x, cmd.y)) return fail('Район вне карты');
  if (!areNeighbors(state.detective.x, state.detective.y, cmd.x, cmd.y)) {
    return fail('Перемещаться можно только в соседний район');
  }
  state.detective = { x: cmd.x, y: cmd.y };
  state.turn.movesLeft -= 1;
  log(state, 'detective', `Машина переехала в район (${cmd.x},${cmd.y}).`);
  return { ok: true, state };
}

function createQuestion(
  state: GameState,
  citizenId: number,
  attribute: QuestionAttribute,
  value: QuestionValue,
  viaDiner: boolean
): ApplyResult {
  if (!isValidQuestion(attribute, value)) return fail('Некорректный вопрос');
  const citizen = getCitizen(state, citizenId);
  const pos = getPosition(state, citizenId);
  if (!citizen || !pos || pos.isDead) return fail('Этого жителя нельзя спросить');
  if (pos.isScared) return fail('Запуганный житель не может отвечать на вопросы');

  const mustBeHonest = !(
    citizenId === state.killer.citizenId || citizen.group === state.killer.allyGroup
  );

  state.pendingQuestion = {
    id: `q-${state.turnNumber}-${state.answers.length + 1}-${Date.now()}`,
    citizenId,
    attribute,
    value,
    viaDiner,
    truth: questionTruth(state, attribute, value),
    mustBeHonest
  };
  state.turn.abilitiesLeft -= 1;
  log(state, 'detective', `Детектив спрашивает жителя ${citizen.job}.`);
  return { ok: true, state };
}

function applyQuestion(state: GameState, cmd: QuestionCommand): ApplyResult {
  if (state.turn.abilitiesLeft <= 0) return fail('Возможности на этот ход закончились');
  if (state.pendingQuestion) return fail('Сначала дождитесь ответа на предыдущий вопрос');
  if (!state.detective) return fail('Машина ещё не поставлена');

  const pos = getPosition(state, cmd.citizenId);
  if (!pos) return fail('Житель не найден');
  if (pos.districtX !== state.detective.x || pos.districtY !== state.detective.y) {
    return fail('Спрашивать можно только жителя в районе с машиной');
  }
  const district = { x: state.detective.x, y: state.detective.y };
  if (state.turn.questionedDistrict && !isSameDistrict(state.turn.questionedDistrict, district)) {
    return fail('Нельзя допрашивать жителей в двух разных районах за один ход');
  }

  const result = createQuestion(state, cmd.citizenId, cmd.attribute, cmd.value, false);
  if (result.ok) {
    state.turn.questionedDistrict = district;
  }
  return result;
}

function applyAnswer(state: GameState, cmd: AnswerCommand): ApplyResult {
  const q = state.pendingQuestion;
  if (!q || q.id !== cmd.questionId) return fail('Нет такого вопроса');
  if (q.mustBeHonest && cmd.answer !== q.truth) {
    return fail('Этому жителю лгать нельзя — убийца обязан ответить честно');
  }
  state.answers.push({
    id: q.id,
    citizenId: q.citizenId,
    attribute: q.attribute,
    value: q.value,
    answer: cmd.answer,
    viaDiner: q.viaDiner,
    turnNumber: state.turnNumber
  });
  state.pendingQuestion = null;
  log(
    state,
    'killer',
    `Житель ${citizenName(state, q.citizenId)} ответил «${cmd.answer ? 'да' : 'нет'}».`
  );
  return { ok: true, state };
}

function applyUseBuilding(state: GameState, cmd: UseBuildingCommand): ApplyResult {
  if (state.turn.abilitiesLeft <= 0) return fail('Возможности на этот ход закончились');
  if (state.pendingQuestion) return fail('Сначала дождитесь ответа на предыдущий вопрос');
  if (!state.detective) return fail('Машина ещё не поставлена');

  const building = state.buildings.find(b => b.id === cmd.buildingId);
  if (!building) return fail('Здание не найдено');
  if (building.districtX !== state.detective.x || building.districtY !== state.detective.y) {
    return fail('Здание можно использовать только из района с машиной');
  }
  if (state.turn.usedBuildingIds.includes(building.id)) {
    return fail('Это здание уже использовано в этот ход');
  }
  if (cmd.payload.kind !== building.type) return fail('Эффект не соответствует типу здания');

  switch (cmd.payload.kind) {
    case 'fire': {
      const { group, moves } = cmd.payload;
      const groupMembers = state.citizens.filter(c => c.group === group).map(c => c.id);
      for (const move of moves) {
        if (!groupMembers.includes(move.citizenId)) {
          return fail('Двигать можно только жителей выбранной группы');
        }
        const pos = getPosition(state, move.citizenId);
        if (!pos || pos.isDead) return fail('Этого жителя нельзя переместить');
        if (!isInsideBoard(move.toX, move.toY)) return fail('Район вне карты');
        if (!areNeighbors(pos.districtX, pos.districtY, move.toX, move.toY)) {
          return fail('Каждого жителя можно сдвинуть только на один район');
        }
      }
      const updated = state.positions.map(p => {
        const move = moves.find(m => m.citizenId === p.citizenId);
        return move ? { ...p, districtX: move.toX, districtY: move.toY } : { ...p };
      });
      if (!validateOccupancy(updated)) {
        return fail(`В районе не может быть больше ${MAX_CITIZENS_PER_DISTRICT} жителей`);
      }
      for (const move of moves) {
        const pos = getPosition(state, move.citizenId)!;
        pos.districtX = move.toX;
        pos.districtY = move.toY;
        pos.subPosition = nextSubPosition(state.positions, move.toX, move.toY);
      }
      log(state, 'detective', `Пожарные: детектив подвигал жителей группы «${group}».`);
      break;
    }
    case 'diner': {
      const { citizenId, attribute, value } = cmd.payload;
      const pos = getPosition(state, citizenId);
      if (!pos) return fail('Житель не найден');
      if (!areNeighbors(building.districtX, building.districtY, pos.districtX, pos.districtY)) {
        return fail('Закусочная позволяет спросить жителя только из соседнего района');
      }
      const result = createQuestion(state, citizenId, attribute, value, true);
      if (!result.ok) return result;
      // createQuestion уже списал возможность — не списываем второй раз ниже
      state.turn.usedBuildingIds.push(building.id);
      return { ok: true, state };
    }
    case 'police': {
      const { citizenId } = cmd.payload;
      const pos = getPosition(state, citizenId);
      if (!pos || pos.isDead) return fail('На этого жителя нельзя положить жетон');
      if (state.policeTokens.some(t => t.citizenId === citizenId)) {
        return fail('На этом жителе уже лежит жетон');
      }
      state.policeTokens.push({ citizenId, placedTurn: state.turnNumber });
      log(state, 'detective', `Полицейский участок: жетон положен на жителя ${citizenName(state, citizenId)}.`);
      break;
    }
    case 'hospital': {
      const { citizenId } = cmd.payload;
      const pos = getPosition(state, citizenId);
      if (!pos || pos.isDead || !pos.isScared) return fail('Этот житель не запуган');
      pos.isScared = false;
      log(state, 'detective', `Скорая помощь: житель ${citizenName(state, citizenId)} больше не запуган.`);
      break;
    }
  }

  state.turn.abilitiesLeft -= 1;
  state.turn.usedBuildingIds.push(building.id);
  return { ok: true, state };
}

function applyPoliceQuestion(state: GameState, cmd: PoliceQuestionCommand): ApplyResult {
  if (state.turn.abilitiesLeft <= 0) return fail('Возможности на этот ход закончились');
  if (state.pendingQuestion) return fail('Сначала дождитесь ответа на предыдущий вопрос');

  const token = state.policeTokens.find(t => t.citizenId === cmd.citizenId);
  if (!token) return fail('На этом жителе нет жетона');
  if (token.placedTurn >= state.turnNumber) {
    return fail('Спросить по жетону можно только на следующем ходу');
  }
  const pos = getPosition(state, cmd.citizenId);
  if (!pos || pos.isDead) return fail('Житель мёртв');

  // На этот вопрос убийца всегда отвечает честно — считает движок
  const answer = canKillNow(state, cmd.citizenId);
  state.policeAnswers.push({
    citizenId: cmd.citizenId,
    canKill: answer,
    turnNumber: state.turnNumber
  });
  state.policeTokens = state.policeTokens.filter(t => t.citizenId !== cmd.citizenId);
  state.turn.abilitiesLeft -= 1;
  log(
    state,
    'system',
    `Жетон: «Можешь ли ты убить жителя ${citizenName(state, cmd.citizenId)} прямо сейчас?» — «${answer ? 'да' : 'нет'}».`
  );
  return { ok: true, state };
}

function applyEndTurn(state: GameState): ApplyResult {
  if (state.pendingQuestion) return fail('Сначала дождитесь ответа на вопрос');
  state.turnNumber += 1;
  state.phase = 'night';
  log(state, 'detective', 'Детектив закончил ход. Наступает ночь.');
  return { ok: true, state };
}

function applyAccuse(state: GameState, cmd: AccuseCommand): ApplyResult {
  const killerCitizen = getCitizen(state, state.killer.citizenId)!;
  const jobCorrect = killerCitizen.job === cmd.job;
  const motiveCorrect = state.killer.motiveId === cmd.motiveId;

  state.phase = 'finished';
  if (jobCorrect && motiveCorrect) {
    state.winner = 'detective';
    state.winReason = `Детектив раскрыл дело: убийца — ${killerCitizen.job}, мотив угадан верно.`;
  } else {
    state.winner = 'killer';
    const wrongPart = !jobCorrect ? 'профессию' : 'мотив';
    state.winReason = `Детектив ошибся (${wrongPart}). Убийцей был ${killerCitizen.job}. Победа убийцы.`;
  }
  log(state, 'system', state.winReason);
  return { ok: true, state };
}

/** Разрешённые команды по фазе и роли */
function checkPermission(state: GameState, role: PlayerRole, cmd: GameCommand): string | null {
  if (state.phase === 'finished') return 'Игра окончена';

  const detectiveOnly: Array<GameCommand['type']> = [
    'detective:placeCar',
    'detective:relocate',
    'detective:move',
    'detective:question',
    'detective:useBuilding',
    'detective:policeQuestion',
    'detective:endTurn',
    'detective:accuse'
  ];
  if (detectiveOnly.includes(cmd.type) && role !== 'detective') return 'Это действие детектива';
  if ((cmd.type === 'killer:night' || cmd.type === 'killer:answer') && role !== 'killer') {
    return 'Это действие убийцы';
  }

  switch (cmd.type) {
    case 'detective:placeCar':
      return state.phase === 'setup' ? null : 'Машина уже поставлена';
    case 'killer:night':
      return state.phase === 'night' ? null : 'Сейчас не ночь';
    case 'detective:relocate':
      return state.phase === 'relocation' ? null : 'Сейчас не нужно расселять жителей';
    case 'detective:move':
    case 'detective:question':
    case 'detective:useBuilding':
    case 'detective:policeQuestion':
    case 'detective:endTurn':
      return state.phase === 'day' ? null : 'Сейчас не день';
    case 'killer:answer':
      return state.pendingQuestion ? null : 'Нет вопроса, требующего ответа';
    case 'detective:accuse':
      return state.phase === 'day' || state.phase === 'accusation'
        ? null
        : 'Сейчас нельзя предъявить обвинение';
  }
}

export function applyCommand(
  prevState: GameState,
  role: PlayerRole,
  cmd: GameCommand
): ApplyResult {
  const permissionError = checkPermission(prevState, role, cmd);
  if (permissionError) return fail(permissionError);

  const state: GameState = cloneState(prevState);

  switch (cmd.type) {
    case 'detective:placeCar':
      return applyPlaceCar(state, cmd);
    case 'killer:night':
      return applyNight(state, cmd);
    case 'detective:relocate':
      return applyRelocate(state, cmd);
    case 'detective:move':
      return applyMove(state, cmd);
    case 'detective:question':
      return applyQuestion(state, cmd);
    case 'killer:answer':
      return applyAnswer(state, cmd);
    case 'detective:useBuilding':
      return applyUseBuilding(state, cmd);
    case 'detective:policeQuestion':
      return applyPoliceQuestion(state, cmd);
    case 'detective:endTurn':
      return applyEndTurn(state);
    case 'detective:accuse':
      return applyAccuse(state, cmd);
  }
}
