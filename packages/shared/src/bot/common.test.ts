import { describe, expect, it } from 'vitest';
import { applyCommand } from '../engine';
import { createGame } from '../setup';
import type { GameState } from '../types';
import { enumerateGroupMoves } from './common';
import { decideBotCommand } from './decide';

/** Бот против бота через общую точку входа — ту же, что вызывает поток на сервере */
function playOut(id: string, onState?: (state: GameState) => void): GameState {
  let state = createGame(id);
  for (let step = 0; step < 900 && state.phase !== 'finished'; step++) {
    let moved = false;
    for (const role of ['killer', 'detective'] as const) {
      const command = decideBotCommand(state, role);
      if (!command) continue;
      const result = applyCommand(state, role, command);
      if (!result.ok) throw new Error(`${role} ${command.type} отклонён в фазе ${state.phase}: ${result.error}`);
      state = result.state;
      onState?.(state);
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return state;
}

describe('общая точка входа ботов', () => {
  it('в каждой фазе ходит ровно одна сторона, и партия доходит до конца', () => {
    for (let i = 0; i < 20; i++) {
      expect(playOut('decide-' + i).phase).toBe('finished');
    }
  });

  it('когда ход человека, бот молчит', () => {
    const state = createGame('decide-quiet');
    // расстановка: детектив ставит машину, убийца пока только выбирает помощников
    expect(decideBotCommand(state, 'killer')?.type).toBe('killer:chooseAlly');
    expect(decideBotCommand({ ...state, phase: 'finished' }, 'detective')).toBeNull();
  });
});

describe('перебор перемещений в фазе Города', () => {
  it('каждый вариант проходит проверку движка, первый — «никого не двигать»', () => {
    let checked = 0;
    for (let i = 0; i < 12; i++) {
      playOut('moves-' + i, state => {
        if (state.phase !== 'city' || !state.city || state.city.emptyGroupNotice || checked > 400) return;
        const role = state.city.stage === 'killer' ? 'killer' : 'detective';
        const options = enumerateGroupMoves(state, state.city.group);
        expect(options[0]).toEqual([]);
        for (const moves of options) {
          const result = applyCommand(state, role, { type: 'city:moveGroup', moves });
          expect(result.ok, result.ok ? '' : result.error).toBe(true);
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});
