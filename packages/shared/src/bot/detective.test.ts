import { describe, expect, it } from 'vitest';
import { applyCommand } from '../engine';
import { createGame } from '../setup';
import type { GameCommand, GameState, PlayerRole } from '../types';
import { consistentHypotheses, decideDetective, motiveScores } from './detective';
import {
  chooseAllyGroup,
  chooseReplacementGroup,
  decideAnswer,
  decideCityMove,
  decideNight
} from './killer';

/** Чей сейчас ход и какую команду отдаёт бот этой стороны */
function nextMove(state: GameState): { role: PlayerRole; command: GameCommand } | null {
  if (state.phase === 'finished') return null;
  if (state.pendingQuestion) {
    return {
      role: 'killer',
      command: {
        type: 'killer:answer',
        questionId: state.pendingQuestion.id,
        answer: decideAnswer(state, state.pendingQuestion)
      }
    };
  }
  if (state.allyGroupChosen === false) {
    return { role: 'killer', command: { type: 'killer:chooseAlly', group: chooseAllyGroup(state)! } };
  }
  if (state.phase === 'night') return { role: 'killer', command: decideNight(state) };
  if (state.phase === 'city' && state.city?.stage === 'killer') {
    if (state.city.emptyGroupNotice) {
      return {
        role: 'killer',
        command: { type: 'city:chooseGroup', group: chooseReplacementGroup(state) as never }
      };
    }
    return { role: 'killer', command: decideCityMove(state) };
  }
  const command = decideDetective(state);
  return command ? { role: 'detective', command } : null;
}

/** Бот против бота до конца партии; на каждом шаге — проверка, что ход принят */
function playOut(id: string, onStep?: (state: GameState) => void): GameState {
  let state = createGame(id);
  for (let step = 0; step < 600; step++) {
    const move = nextMove(state);
    if (!move) break;
    const result = applyCommand(state, move.role, move.command);
    if (!result.ok) {
      throw new Error(`${move.role} ${move.command.type} отклонён в фазе ${state.phase}: ${result.error}`);
    }
    state = result.state;
    onStep?.(state);
  }
  return state;
}

describe('бот-детектив', () => {
  it('каждый его ход принимается движком, и партия доходит до конца', () => {
    let detectiveWins = 0;
    const games = 40;
    for (let i = 0; i < games; i++) {
      const state = playOut('det-bot-' + i);
      expect(state.phase).toBe('finished');
      if (state.winner === 'detective') detectiveWins++;
    }
    // не проверка силы, а ориентир для настройки
    console.log(`бот-детектив против бота-убийцы: ${detectiveWins}/${games}`);
  });

  it('настоящий убийца и его помощники никогда не выпадают из гипотез', () => {
    for (let i = 0; i < 25; i++) {
      playOut('det-sound-' + i, state => {
        if (state.allyGroupChosen === false) return;
        const truth = consistentHypotheses(state).some(
          h => h.killerId === state.killer.citizenId && h.allyGroup === state.killer.allyGroup
        );
        expect(truth).toBe(true);
      });
    }
  });

  it('настоящий мотив всегда среди тех, что не противоречат убийствам', () => {
    for (let i = 0; i < 25; i++) {
      playOut('det-motive-' + i, state => {
        const own = motiveScores(state).find(s => s.id === state.killer.motiveId)!;
        expect(own.consistent).toBe(true);
      });
    }
  });
});
