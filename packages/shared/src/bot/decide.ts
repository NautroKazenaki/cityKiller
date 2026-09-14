import type { GameCommand, GameState, PlayerRole } from '../types';
import { decideDetective } from './detective';
import {
  chooseAllyGroup,
  chooseReplacementGroup,
  decideAnswer,
  decideCityMove,
  decideNight
} from './killer';

/**
 * Ход бота за указанную сторону; null — сейчас ходит человек или ждём его ответа.
 * Одна точка входа и для сервера, и для отдельного потока, где бот считает,
 * не задерживая остальных игроков.
 */
export function decideBotCommand(state: GameState, role: PlayerRole): GameCommand | null {
  if (state.phase === 'finished') return null;

  if (role === 'killer') {
    // группа-помощник выбирается до первой ночи; у старых сохранений поля нет
    if (state.allyGroupChosen === false && (state.phase === 'setup' || state.phase === 'night')) {
      const group = chooseAllyGroup(state);
      return group ? { type: 'killer:chooseAlly', group } : null;
    }
    if (state.pendingQuestion) {
      return {
        type: 'killer:answer',
        questionId: state.pendingQuestion.id,
        answer: decideAnswer(state, state.pendingQuestion)
      };
    }
    if (state.phase === 'night') return decideNight(state);
    if (state.phase === 'city' && state.city?.stage === 'killer') {
      if (state.city.emptyGroupNotice) {
        const group = chooseReplacementGroup(state);
        return group ? { type: 'city:chooseGroup', group: group as never } : null;
      }
      return decideCityMove(state);
    }
    return null;
  }

  return decideDetective(state);
}
