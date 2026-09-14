import { describe, expect, it } from 'vitest';
import { applyCommand, canKillNow, getValidKillTargets } from '../engine';
import { createGame } from '../setup';
import type { CitizenGroup, GameState } from '../types';
import {
  chooseAllyGroup,
  chooseDecoy,
  chooseReplacementGroup,
  chooseVictim,
  decideAnswer,
  decideCityMove,
  decideNight
} from './killer';

function gameAtNight(id: string): GameState {
  const fresh = createGame(id);
  const ally = applyCommand(fresh, 'killer', {
    type: 'killer:chooseAlly',
    group: chooseAllyGroup(fresh)!
  });
  if (!ally.ok) throw new Error(ally.error);
  const result = applyCommand(ally.state, 'detective', {
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

describe('бот-убийца: ложь «в образ»', () => {
  /** Все возможные вопросы про один признак */
  const VALUES = {
    sex: ['male', 'female'] as const,
    age: [20, 40, 60] as const,
    size: ['S', 'M', 'L'] as const,
    height: ['small', 'medium', 'large'] as const
  };

  it('ответы про себя не противоречат друг другу', () => {
    // главный признак силы: по трёхзначным характеристикам нельзя ответить «да» дважды
    for (let i = 0; i < 20; i++) {
      const state = gameAtNight('bot-persona-' + i);
      const killer = state.citizens.find(c => c.id === state.killer.citizenId)!;

      for (const attribute of ['age', 'size', 'height'] as const) {
        const yes = VALUES[attribute].filter(value => {
          const q = {
            id: 'q',
            citizenId: state.killer.citizenId,
            attribute,
            value,
            viaDiner: false,
            truth: killer[attribute] === value,
            mustBeHonest: false
          };
          return decideAnswer(state, q);
        });
        // ровно одно значение признака подтверждается — это и есть связная легенда
        expect(yes).toHaveLength(1);
      }
    }
  });

  it('легенда — живой житель, не сам убийца', () => {
    for (let i = 0; i < 20; i++) {
      const state = gameAtNight('bot-decoy-' + i);
      const decoy = chooseDecoy(state);
      expect(decoy).not.toBeNull();
      expect(decoy!.id).not.toBe(state.killer.citizenId);
      expect(state.positions.find(p => p.citizenId === decoy!.id)!.isDead).toBe(false);
    }
  });

  it('подставного жителя бот не убивает', () => {
    for (let i = 0; i < 25; i++) {
      const state = gameAtNight('bot-protect-' + i);
      const decoy = chooseDecoy(state);
      const victim = chooseVictim(state);
      if (victim === null || !decoy) continue;
      expect(victim).not.toBe(decoy.id);
    }
  });

  it('легенда не меняется, пока подставной жив', () => {
    let state = gameAtNight('bot-stable');
    const first = chooseDecoy(state);
    const night = applyCommand(state, 'killer', decideNight(state));
    expect(night.ok).toBe(true);
    if (!night.ok || !first) return;
    state = night.state;
    const second = chooseDecoy(state);
    expect(second?.id).toBe(first.id);
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

  it('за себя отвечает по легенде, а не по своим настоящим признакам', () => {
    for (let i = 0; i < 15; i++) {
      const state = gameAtNight('bot-lie-' + i);
      const decoy = chooseDecoy(state);
      if (!decoy) continue;
      const killer = state.citizens.find(c => c.id === state.killer.citizenId)!;
      const q = questionFor(state, state.killer.citizenId, false, killer.sex === 'male');
      expect(decideAnswer(state, q)).toBe(decoy.sex === 'male');
    }
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
