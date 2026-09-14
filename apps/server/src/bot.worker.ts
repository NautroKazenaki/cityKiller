import { parentPort } from 'worker_threads';
import { GameState, PlayerRole, decideBotCommand } from '@citykiller/shared';

/**
 * Отдельный поток для бота: перебор ходов не держит основной поток, где сервер
 * обслуживает всех остальных игроков. Логика та же, что и без потока.
 */
parentPort?.on('message', (msg: { id: number; state: GameState; role: PlayerRole }) => {
  try {
    parentPort!.postMessage({ id: msg.id, command: decideBotCommand(msg.state, msg.role) });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, error: e instanceof Error ? e.message : String(e) });
  }
});
