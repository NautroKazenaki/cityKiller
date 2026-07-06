import { getValidKillTargets } from './engine';
import { DetectiveView, GameState, KillerView } from './types';

/** Вид для детектива: без личности убийцы, мотива, группы-помощника и правды в вопросе */
export function viewForDetective(state: GameState): DetectiveView {
  return {
    role: 'detective',
    id: state.id,
    phase: state.phase,
    turnNumber: state.turnNumber,
    citizens: state.citizens,
    positions: state.positions,
    buildings: state.buildings,
    motiveOptions: state.motiveOptions,
    detective: state.detective,
    killsCount: state.killsCount,
    victims: state.victims,
    lastCrimeDistrict: state.lastCrimeDistrict,
    policeTokens: state.policeTokens,
    turn: state.turn,
    pendingQuestion: state.pendingQuestion
      ? {
          id: state.pendingQuestion.id,
          citizenId: state.pendingQuestion.citizenId,
          attribute: state.pendingQuestion.attribute,
          value: state.pendingQuestion.value,
          viaDiner: state.pendingQuestion.viaDiner
        }
      : null,
    answers: state.answers,
    policeAnswers: state.policeAnswers,
    winner: state.winner,
    winReason: state.winReason,
    log: state.log
  };
}

/** Вид для убийцы: полное состояние + подсказка валидных жертв */
export function viewForKiller(state: GameState): KillerView {
  return {
    role: 'killer',
    id: state.id,
    phase: state.phase,
    turnNumber: state.turnNumber,
    citizens: state.citizens,
    positions: state.positions,
    buildings: state.buildings,
    killer: state.killer,
    motiveOptions: state.motiveOptions,
    validKillTargets: state.phase === 'night' ? getValidKillTargets(state) : [],
    detective: state.detective,
    killsCount: state.killsCount,
    victims: state.victims,
    lastCrimeDistrict: state.lastCrimeDistrict,
    policeTokens: state.policeTokens,
    turn: state.turn,
    pendingQuestion: state.pendingQuestion,
    answers: state.answers,
    policeAnswers: state.policeAnswers,
    winner: state.winner,
    winReason: state.winReason,
    log: state.log
  };
}
