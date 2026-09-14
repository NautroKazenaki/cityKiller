import { describe, expect, it } from 'vitest';
import { aliveCitizensIn, getNeighbors } from './board';
import { applyCommand, canKillNow, getValidKillTargets } from './engine';
import { getMotive } from './motives';
import { createGame } from './setup';
import { ALL_GROUPS, GameState } from './types';
import { viewForDetective, viewForKiller } from './views';

function newGameInDay(): GameState {
  let state = newGame('test');
  state = mustApply(state, 'detective', { type: 'detective:placeCar', x: 1, y: 1 });
  state = doNight(state);
  if (state.phase === 'relocation') {
    state = doRelocation(state);
  }
  return state;
}

function mustApply(state: GameState, role: 'detective' | 'killer', cmd: any): GameState {
  const result = applyCommand(state, role, cmd);
  if (!result.ok) throw new Error(`applyCommand failed: ${result.error}`);
  return result.state;
}

/** Новая партия, в которой убийца уже выбрал группу-помощника (иначе ночь не наступит) */
function newGame(id: string): GameState {
  const state = createGame(id);
  return mustApply(state, 'killer', { type: 'killer:chooseAlly', group: state.allyGroupOptions[0] });
}

function doNight(state: GameState): GameState {
  const targets = getValidKillTargets(state);
  const killId = targets.length > 0 ? targets[0] : null;
  const scareCandidates = state.positions
    .filter(p => !p.isDead && !p.isScared && p.citizenId !== killId)
    .map(p => p.citizenId);
  return mustApply(state, 'killer', {
    type: 'killer:night',
    scareIds: scareCandidates.slice(0, 2),
    killId
  });
}

/** Проходит фазу Города без перемещений (для тестов, которым не важна эта фаза) */
function passCityPhase(state: GameState): GameState {
  while (state.phase === 'city' && state.city) {
    const role = state.city.stage === 'killer' ? 'killer' : 'detective';
    if (state.city.emptyGroupNotice) {
      const emptyGroup = state.city.emptyGroupNotice;
      const replacement = state.citizens.find(c => {
        if (c.group === emptyGroup) return false;
        const pos = state.positions.find(p => p.citizenId === c.id);
        return pos !== undefined && !pos.isDead;
      })?.group;
      if (!replacement) break;
      state = mustApply(state, role, { type: 'city:chooseGroup', group: replacement });
      continue;
    }
    state = mustApply(state, role, { type: 'city:moveGroup', moves: [] });
  }
  return state;
}

function doRelocation(state: GameState): GameState {
  const crime = state.lastCrimeDistrict!;
  const stranded = aliveCitizensIn(state.positions, crime.x, crime.y);
  const neighbors = getNeighbors(crime.x, crime.y);

  const moves: Array<{ citizenId: number; toX: number; toY: number }> = [];
  const capacity = new Map<string, number>();
  for (const n of neighbors) {
    capacity.set(`${n.x},${n.y}`, 3 - aliveCitizensIn(state.positions, n.x, n.y).length);
  }
  for (const p of stranded) {
    const target = neighbors.find(n => (capacity.get(`${n.x},${n.y}`) ?? 0) > 0)!;
    capacity.set(`${target.x},${target.y}`, capacity.get(`${target.x},${target.y}`)! - 1);
    moves.push({ citizenId: p.citizenId, toX: target.x, toY: target.y });
  }
  return mustApply(state, 'detective', { type: 'detective:relocate', moves });
}

describe('createGame', () => {
  it('создаёт 20 жителей, 8 зданий, убийцу с мотивом', () => {
    const state = newGame('g1');
    expect(state.citizens).toHaveLength(20);
    expect(state.buildings).toHaveLength(8);
    expect(state.positions).toHaveLength(20);
    expect(state.citizens.some(c => c.id === state.killer.citizenId)).toBe(true);
    expect(getMotive(state.killer.motiveId)).toBeDefined();
    expect(state.phase).toBe('setup');
  });

  it('минимум 5 разных соц. групп среди 20 жителей', () => {
    for (let i = 0; i < 20; i++) {
      const state = newGame('groups-' + i);
      const groups = new Set(state.citizens.map(c => c.group));
      expect(groups.size).toBeGreaterThanOrEqual(5);
    }
  });

  it('в углах по 2 жителя, максимум 3 в районе', () => {
    const state = newGame('g2');
    for (const corner of [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 3 },
      { x: 3, y: 3 }
    ]) {
      expect(aliveCitizensIn(state.positions, corner.x, corner.y)).toHaveLength(2);
    }
  });

  it('у зданий по 2 каждого типа и не больше одного на район', () => {
    const state = newGame('g3');
    const byType = new Map<string, number>();
    const byDistrict = new Set<string>();
    for (const b of state.buildings) {
      byType.set(b.type, (byType.get(b.type) ?? 0) + 1);
      const key = `${b.districtX},${b.districtY}`;
      expect(byDistrict.has(key)).toBe(false);
      byDistrict.add(key);
    }
    expect([...byType.values()]).toEqual([2, 2, 2, 2]);
  });
});

describe('ночь убийцы', () => {
  it('нельзя убить себя, у машины и против мотива', () => {
    const state = mustApply(newGame('g4'), 'detective', {
      type: 'detective:placeCar',
      x: 2,
      y: 2
    });
    expect(canKillNow(state, state.killer.citizenId)).toBe(false);

    const atCar = state.positions.find(
      p => p.districtX === 2 && p.districtY === 2 && !p.isDead
    );
    if (atCar) expect(canKillNow(state, atCar.citizenId)).toBe(false);

    const motive = getMotive(state.killer.motiveId)!;
    for (const id of getValidKillTargets(state)) {
      const victim = state.citizens.find(c => c.id === id)!;
      const victimPosition = state.positions.find(p => p.citizenId === id)!;
      expect(motive.canKill({ victim, victimPosition, state })).toBe(true);
    }
  });

  it('убийство перемещает машину и запускает расселение или день', () => {
    let state = mustApply(newGame('g5'), 'detective', {
      type: 'detective:placeCar',
      x: 1,
      y: 1
    });
    state = doNight(state);
    expect(state.killsCount).toBe(1);
    expect(state.detective).toEqual(state.lastCrimeDistrict);
    expect(['relocation', 'day']).toContain(state.phase);
    const scared = state.positions.filter(p => p.isScared);
    expect(scared.length).toBe(2);
  });

  it('нельзя запугать жертву убийства', () => {
    const state = mustApply(newGame('g6'), 'detective', {
      type: 'detective:placeCar',
      x: 1,
      y: 1
    });
    const killId = getValidKillTargets(state)[0];
    const other = state.positions.find(p => !p.isDead && p.citizenId !== killId)!.citizenId;
    const result = applyCommand(state, 'killer', {
      type: 'killer:night',
      scareIds: [killId, other],
      killId
    });
    expect(result.ok).toBe(false);
  });

  it('добровольный отказ от убийства разрешён один раз за игру', () => {
    const state = mustApply(newGame('decline1'), 'detective', {
      type: 'detective:placeCar',
      x: 0,
      y: 0
    });
    expect(getValidKillTargets(state).length).toBeGreaterThan(0);
    const scareIds = state.positions
      .filter(p => !p.isDead && !p.isScared)
      .map(p => p.citizenId)
      .slice(0, 2);

    const result = applyCommand(state, 'killer', {
      type: 'killer:night',
      scareIds,
      killId: null
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.declinedKillUsed).toBe(true);
    expect(result.state.killsCount).toBe(0);
    expect(result.state.phase).toBe('day');
  });

  it('второй отказ от убийства за игру — автоматическое поражение убийцы', () => {
    let state = mustApply(newGame('decline2'), 'detective', {
      type: 'detective:placeCar',
      x: 0,
      y: 0
    });
    const firstScares = state.positions
      .filter(p => !p.isDead && !p.isScared)
      .map(p => p.citizenId)
      .slice(0, 2);
    state = mustApply(state, 'killer', { type: 'killer:night', scareIds: firstScares, killId: null });
    expect(state.declinedKillUsed).toBe(true);

    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    state = passCityPhase(state);
    expect(getValidKillTargets(state).length).toBeGreaterThan(0);
    const secondScares = state.positions
      .filter(p => !p.isDead && !p.isScared)
      .map(p => p.citizenId)
      .slice(0, 2);

    const result = applyCommand(state, 'killer', {
      type: 'killer:night',
      scareIds: secondScares,
      killId: null
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe('detective');
    expect(result.state.phase).toBe('finished');
  });
});

describe('день детектива', () => {
  it('перемещение только в соседний район, максимум 2 за ход', () => {
    let state = newGameInDay();
    const { x, y } = state.detective!;
    const far = { x: x <= 1 ? 3 : 0, y: y <= 1 ? 3 : 0 };
    expect(applyCommand(state, 'detective', { type: 'detective:move', ...far }).ok).toBe(false);

    const n1 = getNeighbors(x, y)[0];
    state = mustApply(state, 'detective', { type: 'detective:move', x: n1.x, y: n1.y });
    const n2 = getNeighbors(n1.x, n1.y)[0];
    state = mustApply(state, 'detective', { type: 'detective:move', x: n2.x, y: n2.y });
    expect(state.turn.movesLeft).toBe(0);
    const n3 = getNeighbors(n2.x, n2.y)[0];
    expect(applyCommand(state, 'detective', { type: 'detective:move', x: n3.x, y: n3.y }).ok).toBe(
      false
    );
  });

  it('вопрос: убийца обязан отвечать честно про чужих жителей', () => {
    let state = newGameInDay();
    // Ставим машину туда, где стоит «честный» житель
    const honest = state.positions.find(p => {
      if (p.isDead || p.isScared) return false;
      const c = state.citizens.find(ci => ci.id === p.citizenId)!;
      return p.citizenId !== state.killer.citizenId && c.group !== state.killer.allyGroup;
    })!;
    state.detective = { x: honest.districtX, y: honest.districtY };

    const killer = state.citizens.find(c => c.id === state.killer.citizenId)!;
    state = mustApply(state, 'detective', {
      type: 'detective:question',
      citizenId: honest.citizenId,
      attribute: 'sex',
      value: killer.sex
    });
    expect(state.pendingQuestion).not.toBeNull();
    expect(state.pendingQuestion!.truth).toBe(true);
    expect(state.pendingQuestion!.mustBeHonest).toBe(true);

    // Ложь запрещена
    const lie = applyCommand(state, 'killer', {
      type: 'killer:answer',
      questionId: state.pendingQuestion!.id,
      answer: false
    });
    expect(lie.ok).toBe(false);

    state = mustApply(state, 'killer', {
      type: 'killer:answer',
      questionId: state.pendingQuestion!.id,
      answer: true
    });
    expect(state.pendingQuestion).toBeNull();
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0].answer).toBe(true);
  });

  it('нельзя спрашивать в двух разных районах за ход', () => {
    let state = newGameInDay();
    const first = state.positions.find(p => !p.isDead && !p.isScared)!;
    state.detective = { x: first.districtX, y: first.districtY };
    state = mustApply(state, 'detective', {
      type: 'detective:question',
      citizenId: first.citizenId,
      attribute: 'age',
      value: 20
    });
    state = mustApply(state, 'killer', {
      type: 'killer:answer',
      questionId: state.pendingQuestion!.id,
      answer: state.pendingQuestion!.truth
    });

    // Переезжаем и пробуем спросить в другом районе
    const second = state.positions.find(
      p =>
        !p.isDead &&
        !p.isScared &&
        (p.districtX !== first.districtX || p.districtY !== first.districtY)
    )!;
    state.detective = { x: second.districtX, y: second.districtY };
    const result = applyCommand(state, 'detective', {
      type: 'detective:question',
      citizenId: second.citizenId,
      attribute: 'age',
      value: 40
    });
    expect(result.ok).toBe(false);
  });

  it('запуганный житель не отвечает', () => {
    const state = newGameInDay();
    const scared = state.positions.find(p => p.isScared && !p.isDead);
    expect(scared).toBeDefined();
    const stateAt = { ...state, detective: { x: scared!.districtX, y: scared!.districtY } };
    const result = applyCommand(stateAt, 'detective', {
      type: 'detective:question',
      citizenId: scared!.citizenId,
      attribute: 'sex',
      value: 'male'
    });
    expect(result.ok).toBe(false);
  });
});

describe('здания', () => {
  it('скорая снимает испуг', () => {
    let state = newGameInDay();
    const hospital = state.buildings.find(b => b.type === 'hospital')!;
    state.detective = { x: hospital.districtX, y: hospital.districtY };
    const scared = state.positions.find(p => p.isScared)!;
    state = mustApply(state, 'detective', {
      type: 'detective:useBuilding',
      buildingId: hospital.id,
      payload: { kind: 'hospital', citizenId: scared.citizenId }
    });
    expect(state.positions.find(p => p.citizenId === scared.citizenId)!.isScared).toBe(false);
    expect(state.turn.abilitiesLeft).toBe(1);
  });

  it('участок: по жетону можно спросить сразу, ответ всегда честный', () => {
    let state = newGameInDay();
    const police = state.buildings.find(b => b.type === 'police')!;
    state.detective = { x: police.districtX, y: police.districtY };
    const someone = state.positions.find(p => !p.isDead)!;
    state = mustApply(state, 'detective', {
      type: 'detective:useBuilding',
      buildingId: police.id,
      payload: { kind: 'police', citizenId: someone.citizenId }
    });
    expect(state.policeTokens).toHaveLength(1);

    // Спросить можно сразу же: правила не требуют ждать следующий ход
    const expected = canKillNow(state, someone.citizenId);
    const abilitiesBefore = state.turn.abilitiesLeft;
    state = mustApply(state, 'detective', {
      type: 'detective:policeQuestion',
      citizenId: someone.citizenId
    });
    expect(state.policeAnswers[0].canKill).toBe(expected);
    expect(state.policeTokens).toHaveLength(0);
    // Слежка бесплатна — не тратит основные действия
    expect(state.turn.abilitiesLeft).toBe(abilitiesBefore);
  });

  it('пожарные не могут переместить жителя на место преступления', () => {
    let state = newGameInDay();
    const crime = state.lastCrimeDistrict!;
    const fire = state.buildings.find(b => b.type === 'fire')!;
    const neighborOfCrime = getNeighbors(crime.x, crime.y)[0];
    state.detective = { x: fire.districtX, y: fire.districtY };

    // Ставим живого жителя выбранной группы рядом с местом преступления
    const mover = state.positions.find(p => !p.isDead && p.citizenId !== state.killer.citizenId)!;
    mover.districtX = neighborOfCrime.x;
    mover.districtY = neighborOfCrime.y;
    const moverGroup = state.citizens.find(c => c.id === mover.citizenId)!.group;

    const result = applyCommand(state, 'detective', {
      type: 'detective:useBuilding',
      buildingId: fire.id,
      payload: {
        kind: 'fire',
        group: moverGroup,
        moves: [{ citizenId: mover.citizenId, toX: crime.x, toY: crime.y }]
      }
    });
    expect(result.ok).toBe(false);
  });
});

describe('мотивы', () => {
  function stateWithMotive(motiveId: string): GameState {
    const state = newGame('m-' + motiveId);
    state.killer.motiveId = motiveId;
    state.detective = { x: 0, y: 0 };
    return state;
  }

  function posOf(state: GameState, citizenId: number) {
    return state.positions.find(p => p.citizenId === citizenId)!;
  }

  /** Живой житель не-убийца, стоящий НЕ в районе детектива */
  function pickVictim(state: GameState, filter?: (id: number) => boolean): number {
    const found = state.positions.find(p => {
      if (p.isDead || p.citizenId === state.killer.citizenId) return false;
      if (state.detective && p.districtX === state.detective.x && p.districtY === state.detective.y)
        return false;
      return filter ? filter(p.citizenId) : true;
    });
    if (!found) throw new Error('нет подходящей жертвы для теста');
    return found.citizenId;
  }

  it('Грабитель: нельзя рядом с предыдущим местом преступления', () => {
    const state = stateWithMotive('robber');
    const victimId = pickVictim(state);
    const pos = posOf(state, victimId);
    expect(canKillNow(state, victimId)).toBe(true);

    // Предыдущее убийство было в соседнем квартале
    state.lastCrimeDistrict = { x: pos.districtX, y: Math.max(0, pos.districtY - 1) };
    if (state.lastCrimeDistrict.y === pos.districtY) state.lastCrimeDistrict.y = pos.districtY + 1;
    expect(canKillNow(state, victimId)).toBe(false);

    // А в дальнем — можно
    state.lastCrimeDistrict = {
      x: pos.districtX <= 1 ? 3 : 0,
      y: pos.districtY <= 1 ? 3 : 0
    };
    expect(canKillNow(state, victimId)).toBe(true);
  });

  it('Вигилант: нельзя в 8 кварталах вокруг детектива', () => {
    const state = stateWithMotive('vigilante');
    const victimId = pickVictim(state);
    const pos = posOf(state, victimId);

    state.detective = { x: pos.districtX, y: pos.districtY === 0 ? 1 : pos.districtY - 1 };
    expect(canKillNow(state, victimId)).toBe(false);

    state.detective = { x: pos.districtX <= 1 ? 3 : 0, y: pos.districtY <= 1 ? 3 : 0 };
    expect(canKillNow(state, victimId)).toBe(true);
  });

  it('Садист: нельзя убивать запуганных', () => {
    const state = stateWithMotive('sadist');
    const victimId = pickVictim(state);
    expect(canKillNow(state, victimId)).toBe(true);
    posOf(state, victimId).isScared = true;
    expect(canKillNow(state, victimId)).toBe(false);
  });

  it('Маньяк: все жертвы одного пола', () => {
    const state = stateWithMotive('maniac');
    const firstVictim = state.citizens.find(c => c.id !== state.killer.citizenId)!;
    const pos = posOf(state, firstVictim.id);
    pos.isDead = true;
    state.victims.push({
      citizenId: firstVictim.id,
      districtX: pos.districtX,
      districtY: pos.districtY,
      turnNumber: 1,
      wasScared: false
    });
    state.killsCount = 1;

    const sameSex = pickVictim(
      state,
      id => state.citizens.find(c => c.id === id)!.sex === firstVictim.sex
    );
    const otherSex = pickVictim(
      state,
      id => state.citizens.find(c => c.id === id)!.sex !== firstVictim.sex
    );
    expect(canKillNow(state, sameSex)).toBe(true);
    expect(canKillNow(state, otherSex)).toBe(false);
  });

  it('Террорист: все жертвы из разных групп', () => {
    const state = stateWithMotive('terrorist');
    const firstVictim = state.citizens.find(c => c.id !== state.killer.citizenId)!;
    const pos = posOf(state, firstVictim.id);
    pos.isDead = true;
    state.victims.push({
      citizenId: firstVictim.id,
      districtX: pos.districtX,
      districtY: pos.districtY,
      turnNumber: 1,
      wasScared: false
    });
    state.killsCount = 1;

    for (const c of state.citizens) {
      if (c.id === state.killer.citizenId || c.id === firstVictim.id) continue;
      if (c.group === firstVictim.group) {
        expect(canKillNow(state, c.id)).toBe(false);
      }
    }
  });

  it('Шпион: только в кварталах со зданиями', () => {
    const state = stateWithMotive('spy');
    for (const id of getValidKillTargets(state)) {
      const pos = posOf(state, id);
      expect(
        state.buildings.some(
          b => b.districtX === pos.districtX && b.districtY === pos.districtY
        )
      ).toBe(true);
    }
  });

  it('Киллер: только там, где жертва одна', () => {
    const state = stateWithMotive('hitman');
    for (const id of getValidKillTargets(state)) {
      const pos = posOf(state, id);
      expect(aliveCitizensIn(state.positions, pos.districtX, pos.districtY)).toHaveLength(1);
    }
  });

  it('Головорез: нельзя в 4 центральных кварталах', () => {
    const state = stateWithMotive('thug');
    for (const id of getValidKillTargets(state)) {
      const pos = posOf(state, id);
      const inCenter =
        pos.districtX >= 1 && pos.districtX <= 2 && pos.districtY >= 1 && pos.districtY <= 2;
      expect(inCenter).toBe(false);
    }
  });

  it('Психопат: максимум два возраста среди жертв', () => {
    const state = stateWithMotive('psychopath');
    // Две жертвы разных возрастов
    const ages: number[] = [];
    for (const c of state.citizens) {
      if (c.id === state.killer.citizenId) continue;
      if (ages.includes(c.age)) continue;
      const pos = posOf(state, c.id);
      pos.isDead = true;
      state.victims.push({
        citizenId: c.id,
        districtX: pos.districtX,
        districtY: pos.districtY,
        turnNumber: 1,
      wasScared: false
      });
      ages.push(c.age);
      if (ages.length === 2) break;
    }
    state.killsCount = 2;

    const thirdAge = [20, 40, 60].find(a => !ages.includes(a))!;
    for (const c of state.citizens) {
      if (c.id === state.killer.citizenId) continue;
      const pos = posOf(state, c.id);
      if (pos.isDead) continue;
      if (c.age === thirdAge) {
        expect(canKillNow(state, c.id)).toBe(false);
      }
    }
  });

  it('Каннибал: недостающие телосложения должны успеть попасть в жертвы', () => {
    const state = stateWithMotive('cannibal');
    // 4 жертвы одного телосложения S
    const sVictims = state.citizens
      .filter(c => c.id !== state.killer.citizenId && c.size === 'S')
      .slice(0, 4);
    // если S-жителей меньше 4 — добираем любыми, суть теста в счётчике
    const extra = state.citizens.filter(
      c => c.id !== state.killer.citizenId && !sVictims.includes(c)
    );
    const victims = [...sVictims, ...extra].slice(0, 4);
    const sizes = new Set(victims.map(v => v.size));

    for (const v of victims) {
      const pos = posOf(state, v.id);
      pos.isDead = true;
      state.victims.push({
        citizenId: v.id,
        districtX: pos.districtX,
        districtY: pos.districtY,
        turnNumber: 1,
      wasScared: false
      });
    }
    state.killsCount = 4;

    // Остаётся 1 убийство: пятая жертва обязана закрыть недостающие телосложения
    for (const id of getValidKillTargets(state)) {
      const citizen = state.citizens.find(c => c.id === id)!;
      const finalSizes = new Set([...sizes, citizen.size]);
      expect(finalSizes.size).toBe(3);
    }
  });
});

describe('конец игры', () => {
  it('верное обвинение — победа детектива, неверное — убийцы', () => {
    const state = newGameInDay();
    const killerJob = state.citizens.find(c => c.id === state.killer.citizenId)!.job;

    const win = applyCommand(state, 'detective', {
      type: 'detective:accuse',
      job: killerJob,
      motiveId: state.killer.motiveId
    });
    expect(win.ok && win.state.winner === 'detective').toBe(true);

    const lose = applyCommand(state, 'detective', {
      type: 'detective:accuse',
      job: killerJob,
      motiveId: 'wrong-motive'
    });
    expect(lose.ok && lose.state.winner === 'killer').toBe(true);
  });

  it('после 5 убийств — фаза обвинения', () => {
    let state = mustApply(newGame('g7'), 'detective', {
      type: 'detective:placeCar',
      x: 1,
      y: 1
    });
    for (let i = 0; i < 20 && state.phase !== 'accusation' && state.phase !== 'finished'; i++) {
      if (state.phase === 'night') state = doNight(state);
      else if (state.phase === 'relocation') state = doRelocation(state);
      else if (state.phase === 'city') state = passCityPhase(state);
      else if (state.phase === 'day') {
        state = mustApply(state, 'detective', { type: 'detective:endTurn' });
      }
    }
    // Либо убийца добрался до 5 убийств, либо у него закончились жертвы (пат)
    if (state.killsCount >= 5) {
      expect(state.phase).toBe('accusation');
      const wrongAccuse = applyCommand(state, 'detective', {
        type: 'detective:accuse',
        job: 'несуществующая профессия',
        motiveId: 'x'
      });
      expect(wrongAccuse.ok && wrongAccuse.state.winner === 'killer').toBe(true);
    }
  });
});

describe('фаза Города', () => {
  it('после дня наступает фаза Города, а не сразу ночь', () => {
    let state = newGameInDay();
    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    expect(state.phase).toBe('city');
    expect(state.city?.stage).toBe('killer');
  });

  it('население: запуганные жители в квартале Детектива успокаиваются перед фазой Города', () => {
    let state = newGameInDay();
    const scared = state.positions.find(p => p.isScared && !p.isDead)!;
    state.detective = { x: scared.districtX, y: scared.districtY };

    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    expect(state.positions.find(p => p.citizenId === scared.citizenId)!.isScared).toBe(false);
  });

  it('убийца двигает жителей показанной группы максимум на 1 район, затем ход переходит детективу', () => {
    let state = newGameInDay();
    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    expect(state.city!.stage).toBe('killer');

    // Показанной группы может не остаться в живых — тогда убийца сначала выбирает замену
    if (state.city!.emptyGroupNotice) {
      const emptyGroup = state.city!.emptyGroupNotice;
      const replacement = state.citizens.find(c => {
        if (c.group === emptyGroup) return false;
        return !state.positions.find(p => p.citizenId === c.id)!.isDead;
      })!.group;
      state = mustApply(state, 'killer', { type: 'city:chooseGroup', group: replacement });
    }
    expect(state.city!.emptyGroupNotice).toBeNull();

    const group = state.city!.group;
    const crime = state.lastCrimeDistrict;
    const candidates = state.positions.filter(p => {
      if (p.isDead) return false;
      const c = state.citizens.find(ci => ci.id === p.citizenId)!;
      return c.group === group;
    });
    // Берём жителя группы, у которого есть хотя бы один сосед, не являющийся местом преступления
    let mover = candidates[0];
    let neighbor = getNeighbors(mover.districtX, mover.districtY).find(
      n => !crime || n.x !== crime.x || n.y !== crime.y
    );
    for (const cand of candidates) {
      const free = getNeighbors(cand.districtX, cand.districtY).find(
        n => !crime || n.x !== crime.x || n.y !== crime.y
      );
      if (free) {
        mover = cand;
        neighbor = free;
        break;
      }
    }
    if (!neighbor) return; // все соседи всех кандидатов — место преступления, сценарий неприменим
    const far = { x: mover.districtX <= 1 ? 3 : 0, y: mover.districtY <= 1 ? 3 : 0 };

    // Дальше одного квартала — нельзя
    const badMove = applyCommand(state, 'killer', {
      type: 'city:moveGroup',
      moves: [{ citizenId: mover.citizenId, toX: far.x, toY: far.y }]
    });
    expect(badMove.ok).toBe(false);

    // Детектив не может ходить, пока не завершил ход Убийца
    const wrongTurn = applyCommand(state, 'detective', { type: 'city:moveGroup', moves: [] });
    expect(wrongTurn.ok).toBe(false);

    state = mustApply(state, 'killer', {
      type: 'city:moveGroup',
      moves: [{ citizenId: mover.citizenId, toX: neighbor.x, toY: neighbor.y }]
    });
    expect(state.positions.find(p => p.citizenId === mover.citizenId)).toMatchObject({
      districtX: neighbor.x,
      districtY: neighbor.y
    });
    expect(state.phase).toBe('city');
    expect(state.city!.stage).toBe('detective');

    // Детективу тоже может достаться пустая группа — сначала разрешаем её
    if (state.city!.emptyGroupNotice) {
      const emptyGroup = state.city!.emptyGroupNotice;
      const replacement = state.citizens.find(c => {
        if (c.group === emptyGroup) return false;
        return !state.positions.find(p => p.citizenId === c.id)!.isDead;
      })!.group;
      state = mustApply(state, 'detective', { type: 'city:chooseGroup', group: replacement });
    }

    // Детектив может пройти без перемещений — раунд завершится ночью
    state = mustApply(state, 'detective', { type: 'city:moveGroup', moves: [] });
    expect(state.phase).toBe('night');
    expect(state.city).toBeNull();
  });

  it('нельзя перемещать в фазе Города больше 3 жителей в квартал', () => {
    let state = newGameInDay();
    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    const group = state.city!.group;
    const groupPositions = state.positions.filter(p => {
      if (p.isDead) return false;
      return state.citizens.find(c => c.id === p.citizenId)!.group === group;
    });
    if (groupPositions.length < 2) return; // мотив/группа слишком маленькие для этого сценария

    // Забиваем соседний квартал до предела тремя ЧУЖИМИ жителями
    const mover = groupPositions[0];
    const neighbor = getNeighbors(mover.districtX, mover.districtY)[0];
    const others = state.positions.filter(
      p => !p.isDead && p.citizenId !== mover.citizenId
    );
    let filled = 0;
    for (const p of others) {
      if (filled >= 3) break;
      if (p.districtX === neighbor.x && p.districtY === neighbor.y) {
        filled++;
        continue;
      }
      p.districtX = neighbor.x;
      p.districtY = neighbor.y;
      filled++;
    }
    if (filled < 3) return;

    const result = applyCommand(state, 'killer', {
      type: 'city:moveGroup',
      moves: [{ citizenId: mover.citizenId, toX: neighbor.x, toY: neighbor.y }]
    });
    expect(result.ok).toBe(false);
  });

  it('нельзя перемещать жителей в фазе Города на место преступления', () => {
    let state = newGameInDay();
    const crime = state.lastCrimeDistrict!;
    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    const group = state.city!.group;
    const neighborOfCrime = getNeighbors(crime.x, crime.y)[0];
    const mover = state.positions.find(p => !p.isDead && p.citizenId !== state.killer.citizenId)!;
    mover.districtX = neighborOfCrime.x;
    mover.districtY = neighborOfCrime.y;
    const moverCitizen = state.citizens.find(c => c.id === mover.citizenId)!;
    moverCitizen.group = group;

    const role = state.city!.stage === 'killer' ? 'killer' : 'detective';
    const result = applyCommand(state, role, {
      type: 'city:moveGroup',
      moves: [{ citizenId: mover.citizenId, toX: crime.x, toY: crime.y }]
    });
    expect(result.ok).toBe(false);
  });

  it('пустая группа: игрок обязан выбрать замену, пустой жетон удаляется из пула навсегда', () => {
    let state = newGameInDay();
    // Убиваем всех живых представителей одной группы, чтобы она стала «пустой»
    const emptyGroup = state.citizens.find(c => c.id !== state.killer.citizenId)!.group;
    for (const c of state.citizens) {
      if (c.group === emptyGroup) {
        state.positions.find(p => p.citizenId === c.id)!.isDead = true;
      }
    }
    state.phase = 'city';
    state.city = { stage: 'killer', group: emptyGroup, emptyGroupNotice: emptyGroup };

    // Двигать пустую группу нельзя, пока не выбрана замена
    const blocked = applyCommand(state, 'killer', { type: 'city:moveGroup', moves: [] });
    expect(blocked.ok).toBe(false);

    // Нельзя «заменить» на ту же пустую группу
    const sameGroup = applyCommand(state, 'killer', {
      type: 'city:chooseGroup',
      group: emptyGroup
    });
    expect(sameGroup.ok).toBe(false);

    const liveGroup = state.citizens.find(c => {
      if (c.group === emptyGroup) return false;
      const pos = state.positions.find(p => p.citizenId === c.id)!;
      return !pos.isDead;
    })!.group;

    state = mustApply(state, 'killer', { type: 'city:chooseGroup', group: liveGroup });
    expect(state.city!.group).toBe(liveGroup);
    expect(state.city!.emptyGroupNotice).toBeNull();
    expect(state.cityTokenPool).not.toContain(emptyGroup);

    // Теперь ход можно продолжить как обычно
    state = mustApply(state, 'killer', { type: 'city:moveGroup', moves: [] });
    expect(state.city!.stage).toBe('detective');
  });
});

describe('лимит раундов', () => {
  it('после 6-го раунда без 5 убийств — автопобеда детектива', () => {
    let state = newGameInDay();
    state.turnNumber = 6;

    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    expect(state.phase).toBe('city');

    while (state.phase === 'city' && state.city) {
      const role = state.city.stage === 'killer' ? 'killer' : 'detective';
      if (state.city.emptyGroupNotice) {
        const emptyGroup = state.city.emptyGroupNotice;
        const replacement = state.citizens.find(c => {
          if (c.group === emptyGroup) return false;
          return !state.positions.find(p => p.citizenId === c.id)!.isDead;
        })!.group;
        state = mustApply(state, role, { type: 'city:chooseGroup', group: replacement });
        continue;
      }
      state = mustApply(state, role, { type: 'city:moveGroup', moves: [] });
    }

    expect(state.phase).toBe('finished');
    expect(state.winner).toBe('detective');
    expect(state.turnNumber).toBe(6);
  });

  it('раунды 1-5 продолжаются как обычно (лимит не срабатывает раньше времени)', () => {
    let state = newGameInDay();
    state.turnNumber = 5;
    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    expect(state.phase).toBe('city');
    expect(state.winner).toBeNull();
  });
});

describe('расселение: исключение для заполненных соседей', () => {
  it('если все соседние районы заполнены, разрешено расселить в любой свободный квартал', () => {
    let state = mustApply(newGame('reloc-exc'), 'detective', {
      type: 'detective:placeCar',
      x: 1,
      y: 1
    });
    state = doNight(state);
    if (state.phase !== 'relocation') return; // жертва была в квартале одна — сценарий неприменим

    const crime = state.lastCrimeDistrict!;
    const neighbors = getNeighbors(crime.x, crime.y);
    const stranded = aliveCitizensIn(state.positions, crime.x, crime.y);
    const strandedIds = new Set(stranded.map(p => p.citizenId));

    // Пул «чужих» жителей, которых можно использовать, чтобы забить соседей до предела
    const fillerPool = state.positions.filter(
      p =>
        !p.isDead &&
        !strandedIds.has(p.citizenId) &&
        !neighbors.some(n => n.x === p.districtX && n.y === p.districtY)
    );

    let fillerIndex = 0;
    for (const n of neighbors) {
      let already = aliveCitizensIn(state.positions, n.x, n.y).length;
      while (already < 3) {
        if (fillerIndex >= fillerPool.length) return; // недостаточно жителей для сценария — пропускаем
        fillerPool[fillerIndex].districtX = n.x;
        fillerPool[fillerIndex].districtY = n.y;
        fillerIndex++;
        already++;
      }
    }
    for (const n of neighbors) {
      expect(aliveCitizensIn(state.positions, n.x, n.y).length).toBe(3);
    }

    // Дальний квартал: не место преступления, не сосед, есть свободное место
    const allDistricts: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) allDistricts.push({ x, y });
    const far = allDistricts.find(
      d =>
        !(d.x === crime.x && d.y === crime.y) &&
        !neighbors.some(n => n.x === d.x && n.y === d.y) &&
        aliveCitizensIn(state.positions, d.x, d.y).length + stranded.length <= 3
    );
    if (!far) return; // не нашлось подходящего дальнего квартала — пропускаем сценарий

    const moves = stranded.map(p => ({ citizenId: p.citizenId, toX: far.x, toY: far.y }));
    const result = applyCommand(state, 'detective', { type: 'detective:relocate', moves });
    expect(result.ok).toBe(true);
  });
});

describe('повторный допрос', () => {
  /** Доводит партию до дня и ставит машину к живому жителю */
  function dayWithNeighbour(): { state: GameState; citizenId: number } | null {
    const state = newGameInDay();
    const car = state.detective!;
    const here = state.positions.find(
      p => !p.isDead && !p.isScared && p.districtX === car.x && p.districtY === car.y
    );
    return here ? { state, citizenId: here.citizenId } : null;
  }

  it('одного жителя нельзя спросить дважды за ход', () => {
    const prepared = dayWithNeighbour();
    if (!prepared) return;
    let { state } = prepared;
    const { citizenId } = prepared;

    const first = applyCommand(state, 'detective', {
      type: 'detective:question',
      citizenId,
      attribute: 'sex',
      value: 'male'
    });
    expect(first.ok, first.ok ? '' : first.error).toBe(true);
    if (!first.ok) return;
    state = first.state;

    // отвечаем, чтобы освободить pendingQuestion
    const answered = applyCommand(state, 'killer', {
      type: 'killer:answer',
      questionId: state.pendingQuestion!.id,
      answer: state.pendingQuestion!.truth
    });
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    state = answered.state;

    // второе действие хода на того же жителя — запрещено
    const second = applyCommand(state, 'detective', {
      type: 'detective:question',
      citizenId,
      attribute: 'age',
      value: 40
    });
    expect(second.ok).toBe(false);
  });

  it('запрет снимается со следующим ходом', () => {
    const prepared = dayWithNeighbour();
    if (!prepared) return;
    let { state } = prepared;
    const { citizenId } = prepared;

    state = mustApply(state, 'detective', {
      type: 'detective:question',
      citizenId,
      attribute: 'sex',
      value: 'male'
    });
    state = mustApply(state, 'killer', {
      type: 'killer:answer',
      questionId: state.pendingQuestion!.id,
      answer: state.pendingQuestion!.truth
    });
    expect(state.turn.questionedCitizenIds).toContain(citizenId);

    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    expect(state.turn.questionedCitizenIds).not.toContain(citizenId);
  });
});

describe('фаза Города: пустой жетон', () => {
  /** Группа, которой вообще нет среди 20 жителей — именно такой жетон вешал партию */
  function missingGroup(state: GameState) {
    return state.cityTokenPool.find(g => !state.citizens.some(c => c.group === g));
  }

  it('обе стороны могут заменить пустой жетон, а не застревают', () => {
    for (const stage of ['killer', 'detective'] as const) {
      let found = false;
      for (let i = 0; i < 25 && !found; i++) {
        const state = newGame(`empty-${stage}-${i}`);
        const empty = missingGroup(state);
        if (!empty) continue;
        found = true;

        state.phase = 'city';
        state.city = { stage, group: empty, emptyGroupNotice: empty };

        const replacement = state.citizens[0].group;
        const role = stage === 'killer' ? 'killer' : 'detective';
        const result = applyCommand(state, role, {
          type: 'city:chooseGroup',
          group: replacement
        });
        expect(result.ok, result.ok ? '' : result.error).toBe(true);
        if (!result.ok) return;
        expect(result.state.city?.group).toBe(replacement);
        expect(result.state.city?.emptyGroupNotice).toBeNull();
        // пустой жетон уходит из пула навсегда — второй раз партия об него не споткнётся
        expect(result.state.cityTokenPool).not.toContain(empty);
      }
      expect(found).toBe(true);
    }
  });
});

describe('выбор группы-помощника', () => {
  it('убийце предлагают три разные группы, и в каждой есть кто-то кроме него', () => {
    for (let i = 0; i < 20; i++) {
      const state = createGame('ally-options-' + i);
      expect(state.allyGroupOptions).toHaveLength(3);
      expect(new Set(state.allyGroupOptions).size).toBe(3);
      for (const g of state.allyGroupOptions) {
        expect(state.citizens.some(c => c.group === g && c.id !== state.killer.citizenId)).toBe(true);
      }
      expect(state.allyGroupChosen).toBe(false);
    }
  });

  it('без выбора ночь не наступает, выбрать можно только из предложенных и один раз', () => {
    let state = createGame('ally-flow');
    state = mustApply(state, 'detective', { type: 'detective:placeCar', x: 1, y: 1 });

    const targets = getValidKillTargets(state);
    const scares = state.positions
      .filter(p => !p.isDead && p.citizenId !== targets[0])
      .slice(0, 2)
      .map(p => p.citizenId);
    const early = applyCommand(state, 'killer', {
      type: 'killer:night',
      scareIds: scares,
      killId: targets[0] ?? null
    });
    expect(early.ok).toBe(false);

    const notOffered = ALL_GROUPS.find(g => !state.allyGroupOptions.includes(g))!;
    expect(applyCommand(state, 'killer', { type: 'killer:chooseAlly', group: notOffered }).ok).toBe(false);
    expect(
      applyCommand(state, 'detective', { type: 'killer:chooseAlly', group: state.allyGroupOptions[1] }).ok
    ).toBe(false);

    state = mustApply(state, 'killer', { type: 'killer:chooseAlly', group: state.allyGroupOptions[1] });
    expect(state.killer.allyGroup).toBe(state.allyGroupOptions[1]);
    expect(
      applyCommand(state, 'killer', { type: 'killer:chooseAlly', group: state.allyGroupOptions[2] }).ok
    ).toBe(false);

    expect(applyCommand(state, 'killer', {
      type: 'killer:night',
      scareIds: scares,
      killId: targets[0] ?? null
    }).ok).toBe(true);
  });

  it('детектив не видит ни вариантов, ни выбора, и в логе выбор не упоминается', () => {
    const before = createGame('ally-secret');
    const after = mustApply(before, 'killer', {
      type: 'killer:chooseAlly',
      group: before.allyGroupOptions[2]
    });
    for (const s of [before, after]) {
      const json = JSON.stringify(viewForDetective(s));
      expect(json).not.toContain('allyGroup');
    }
    expect(after.log).toEqual(before.log);
  });
});

describe('после пятого убийства', () => {
  function accusationWithToken(): { state: GameState; citizenId: number } {
    const state = newGameInDay();
    const citizenId = state.positions.find(
      p => !p.isDead && p.citizenId !== state.killer.citizenId
    )!.citizenId;
    state.policeTokens.push({ citizenId, placedTurn: state.turnNumber });
    state.phase = 'accusation';
    return { state, citizenId };
  }

  it('жетон слежки срабатывает до обвинения', () => {
    const { state, citizenId } = accusationWithToken();
    const asked = mustApply(state, 'detective', { type: 'detective:policeQuestion', citizenId });
    expect(asked.phase).toBe('accusation');
    expect(asked.policeAnswers.at(-1)!.citizenId).toBe(citizenId);
    expect(asked.policeTokens.some(t => t.citizenId === citizenId)).toBe(false);
  });

  it('но ездить и допрашивать уже нельзя', () => {
    const { state } = accusationWithToken();
    expect(applyCommand(state, 'detective', { type: 'detective:endTurn' }).ok).toBe(false);
    expect(applyCommand(state, 'detective', { type: 'detective:move', x: 0, y: 0 }).ok).toBe(false);
  });
});

describe('обвинение сохраняется для финала', () => {
  it('в состоянии и в обоих видах — кого назвали и что угадано', () => {
    const state = newGameInDay();
    const wrongJob = state.citizens.find(c => c.id !== state.killer.citizenId)!.job;
    const finished = mustApply(state, 'detective', {
      type: 'detective:accuse',
      job: wrongJob,
      motiveId: state.killer.motiveId
    });
    const expected = {
      job: wrongJob,
      motiveId: state.killer.motiveId,
      jobCorrect: false,
      motiveCorrect: true
    };
    expect(finished.accusation).toEqual(expected);
    expect(viewForDetective(finished).accusation).toEqual(expected);
    expect(viewForKiller(finished).accusation).toEqual(expected);
    expect(viewForDetective(state).accusation).toBeNull();
  });
});

describe('виды состояния', () => {
  it('детектив не видит убийцу, мотив и правду вопроса', () => {
    const state = newGameInDay();
    const view = viewForDetective(state);
    expect((view as Record<string, unknown>).killer).toBeUndefined();
    const json = JSON.stringify(view);
    expect(json).not.toContain('motiveId');
    expect(json).not.toContain('allyGroup');
    expect(json).not.toContain('mustBeHonest');
    expect(json).not.toContain('"truth"');
  });

  it('разгадка приходит детективу только после финала', () => {
    const state = newGameInDay();
    expect(viewForDetective(state).reveal).toBeNull();

    const killerJob = state.citizens.find(c => c.id === state.killer.citizenId)!.job;
    const finished = applyCommand(state, 'detective', {
      type: 'detective:accuse',
      job: killerJob,
      motiveId: 'заведомо неверный мотив'
    });
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;

    // проиграв, детектив всё равно обязан узнать, кто это был и почему
    const reveal = viewForDetective(finished.state).reveal;
    expect(reveal).not.toBeNull();
    expect(reveal!.citizenId).toBe(state.killer.citizenId);
    expect(reveal!.motiveId).toBe(state.killer.motiveId);
    expect(reveal!.allyGroup).toBe(state.killer.allyGroup);
  });

  it('убийца видит свою личность и валидные цели ночью', () => {
    let state = newGame('g8');
    state = mustApply(state, 'detective', { type: 'detective:placeCar', x: 0, y: 0 });
    const view = viewForKiller(state);
    expect(view.killer.citizenId).toBe(state.killer.citizenId);
    expect(view.validKillTargets).toEqual(getValidKillTargets(state));
  });
});
