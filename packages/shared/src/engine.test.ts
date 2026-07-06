import { describe, expect, it } from 'vitest';
import { aliveCitizensIn, getNeighbors } from './board';
import { applyCommand, canKillNow, getValidKillTargets } from './engine';
import { getMotive } from './motives';
import { createGame } from './setup';
import { GameState } from './types';
import { viewForDetective, viewForKiller } from './views';

function newGameInDay(): GameState {
  let state = createGame('test');
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
    const state = createGame('g1');
    expect(state.citizens).toHaveLength(20);
    expect(state.buildings).toHaveLength(8);
    expect(state.positions).toHaveLength(20);
    expect(state.citizens.some(c => c.id === state.killer.citizenId)).toBe(true);
    expect(getMotive(state.killer.motiveId)).toBeDefined();
    expect(state.phase).toBe('setup');
  });

  it('в углах по 2 жителя, максимум 3 в районе', () => {
    const state = createGame('g2');
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
    const state = createGame('g3');
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
    const state = mustApply(createGame('g4'), 'detective', {
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
    let state = mustApply(createGame('g5'), 'detective', {
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
    const state = mustApply(createGame('g6'), 'detective', {
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

  it('участок: жетон работает только со следующего хода и отвечает честно', () => {
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

    // В этот же ход спросить нельзя
    const early = applyCommand(state, 'detective', {
      type: 'detective:policeQuestion',
      citizenId: someone.citizenId
    });
    expect(early.ok).toBe(false);

    // Следующий ход
    state = mustApply(state, 'detective', { type: 'detective:endTurn' });
    state = doNight(state);
    if (state.phase === 'relocation') state = doRelocation(state);
    if (state.phase !== 'day') return; // 5-е убийство в тесте маловероятно

    const expected = canKillNow(state, someone.citizenId);
    state = mustApply(state, 'detective', {
      type: 'detective:policeQuestion',
      citizenId: someone.citizenId
    });
    expect(state.policeAnswers[0].canKill).toBe(expected);
    expect(state.policeTokens).toHaveLength(0);
  });
});

describe('мотивы', () => {
  function stateWithMotive(motiveId: string): GameState {
    const state = createGame('m-' + motiveId);
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
      turnNumber: 1
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
      turnNumber: 1
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
        turnNumber: 1
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
        turnNumber: 1
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
    let state = mustApply(createGame('g7'), 'detective', {
      type: 'detective:placeCar',
      x: 1,
      y: 1
    });
    for (let i = 0; i < 20 && state.phase !== 'accusation' && state.phase !== 'finished'; i++) {
      if (state.phase === 'night') state = doNight(state);
      else if (state.phase === 'relocation') state = doRelocation(state);
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

  it('убийца видит свою личность и валидные цели ночью', () => {
    let state = createGame('g8');
    state = mustApply(state, 'detective', { type: 'detective:placeCar', x: 0, y: 0 });
    const view = viewForKiller(state);
    expect(view.killer.citizenId).toBe(state.killer.citizenId);
    expect(view.validKillTargets).toEqual(getValidKillTargets(state));
  });
});
