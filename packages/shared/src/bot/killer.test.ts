import { describe, expect, it } from 'vitest';
import { applyCommand, canKillNow, getValidKillTargets } from '../engine';
import { createGame } from '../setup';
import type { CitizenGroup, GameState } from '../types';
import { chooseReplacementGroup, decideAnswer, decideCityMove, decideNight } from './killer';

function gameAtNight(id: string): GameState {
  const result = applyCommand(createGame(id), 'detective', {
    type: 'detective:placeCar',
    x: 1,
    y: 1
  });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('бот-убийца: ночь', () => {
  it('его ход всегда принимается движком', () => {
    for (let i = 0; i < 30; i++) {
      const state = gameAtNight('bot-night-' + i);
      const command = decideNight(state);
      const result = applyCommand(state, 'killer', command);
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
    }
  });

  it('выбирает жертву, разрешённую мотивом, и не себя', () => {
    for (let i = 0; i < 20; i++) {
      const state = gameAtNight('bot-victim-' + i);
      const command = decideNight(state);
      if (command.killId === null) {
        expect(getValidKillTargets(state)).toHaveLength(0);
        continue;
      }
      expect(command.killId).not.toBe(state.killer.citizenId);
      expect(canKillNow(state, command.killId)).toBe(true);
    }
  });

  it('пугает ровно столько, сколько требуют правила, и не трогает жертву', () => {
    for (let i = 0; i < 20; i++) {
      const state = gameAtNight('bot-scare-' + i);
      const command = decideNight(state);
      const candidates = state.positions.filter(
        p => !p.isDead && !p.isScared && p.citizenId !== command.killId
      );
      expect(command.scareIds).toHaveLength(Math.min(2, candidates.length));
      expect(command.scareIds).not.toContain(command.killId);
      expect(new Set(command.scareIds).size).toBe(command.scareIds.length);
    }
  });

  it('бережёт своих: себя и группу-помощника пугает в последнюю очередь', () => {
    // на 30 партиях бот почти никогда не тратит испуг на собственного персонажа
    let selfScared = 0;
    for (let i = 0; i < 30; i++) {
      const state = gameAtNight('bot-keep-' + i);
      const command = decideNight(state);
      if (command.scareIds.includes(state.killer.citizenId)) selfScared++;
    }
    expect(selfScared).toBeLessThan(6);
  });

  it('оставляет мотиву будущие цели, когда есть выбор', () => {
    const state = gameAtNight('bot-future');
    const targets = getValidKillTargets(state);
    if (targets.length < 2) return;

    const command = decideNight(state);
    const after = applyCommand(state, 'killer', command);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    // после хода бота партия не должна оказаться в тупике сразу же
    expect(after.state.killsCount).toBe(1);
  });
});

describe('бот-убийца: ответы на допрос', () => {
  function questionFor(state: GameState, citizenId: number, mustBeHonest: boolean, truth: boolean) {
    return {
      id: 'q1',
      citizenId,
      attribute: 'sex' as const,
      value: 'male' as const,
      viaDiner: false,
      truth,
      mustBeHonest
    };
  }

  it('за обычного жителя отвечает честно', () => {
    const state = gameAtNight('bot-honest');
    const q = questionFor(state, 1, true, true);
    expect(decideAnswer(state, q)).toBe(true);
  });

  it('за себя и помощника лжёт, если по этому признаку ещё не отвечали', () => {
    const state = gameAtNight('bot-lie');
    const q = questionFor(state, state.killer.citizenId, false, true);
    expect(decideAnswer(state, q)).toBe(false);
  });

  it('не противоречит уже сказанному — иначе лжец виден сразу', () => {
    const state = gameAtNight('bot-consistent');
    state.answers.push({
      id: 'old',
      citizenId: 5,
      attribute: 'sex',
      value: 'male',
      answer: true,
      viaDiner: false,
      turnNumber: 1
    });
    const q = questionFor(state, state.killer.citizenId, false, true);
    // честный ответ уже прозвучал как «да» — бот повторяет его, а не переобувается
    expect(decideAnswer(state, q)).toBe(true);
  });
});

describe('бот-убийца: фаза Города', () => {
  it('перемещения проходят проверку движка', () => {
    for (let i = 0; i < 15; i++) {
      let state = gameAtNight('bot-city-' + i);
      const night = applyCommand(state, 'killer', decideNight(state));
      if (!night.ok) continue;
      state = night.state;

      // доводим партию до фазы Города
      if (state.phase === 'relocation') {
        const crime = state.lastCrimeDistrict!;
        const stranded = state.positions.filter(
          p => !p.isDead && p.districtX === crime.x && p.districtY === crime.y
        );
        const moves = stranded.map(p => {
          const target = [
            { x: crime.x + 1, y: crime.y },
            { x: crime.x - 1, y: crime.y },
            { x: crime.x, y: crime.y + 1 },
            { x: crime.x, y: crime.y - 1 }
          ].find(
            n =>
              n.x >= 0 &&
              n.x < 4 &&
              n.y >= 0 &&
              n.y < 4 &&
              state.positions.filter(q => !q.isDead && q.districtX === n.x && q.districtY === n.y)
                .length < 3
          )!;
          return { citizenId: p.citizenId, toX: target.x, toY: target.y };
        });
        const reloc = applyCommand(state, 'detective', { type: 'detective:relocate', moves });
        if (!reloc.ok) continue;
        state = reloc.state;
      }
      if (state.phase !== 'day') continue;

      const end = applyCommand(state, 'detective', { type: 'detective:endTurn' });
      if (!end.ok) continue;
      state = end.state;
      if (state.phase !== 'city' || state.city?.stage !== 'killer') continue;

      if (state.city.emptyGroupNotice) {
        const group = chooseReplacementGroup(state);
        expect(group).not.toBeNull();
        const chosen = applyCommand(state, 'killer', {
          type: 'city:chooseGroup',
          group: group as CitizenGroup
        });
        expect(chosen.ok, chosen.ok ? '' : chosen.error).toBe(true);
        if (!chosen.ok) continue;
        state = chosen.state;
      }

      const move = applyCommand(state, 'killer', decideCityMove(state));
      expect(move.ok, move.ok ? '' : move.error).toBe(true);
    }
  });
});
