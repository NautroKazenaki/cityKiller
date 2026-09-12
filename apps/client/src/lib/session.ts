import type { PlayerRole } from '@citykiller/shared';

export interface GameSession {
  roomCode: string;
  playerToken: string;
  role: PlayerRole;
  username: string;
}

const KEY_PREFIX = 'citykiller-session-';

/**
 * Сессия хранится в двух местах:
 * - sessionStorage — своя на каждую вкладку, поэтому две вкладки одного браузера
 *   могут играть за разные роли (удобно и для игры вдвоём за одним компьютером, и для отладки);
 * - localStorage — переживает перезапуск браузера, используется как запасной вариант.
 */
export function saveSession(session: GameSession): void {
  const key = KEY_PREFIX + session.roomCode.toUpperCase();
  const raw = JSON.stringify(session);
  try {
    sessionStorage.setItem(key, raw);
  } catch {
    // приватный режим — переживём
  }
  try {
    localStorage.setItem(key, raw);
  } catch {
    // приватный режим — переживём
  }
}

export function loadSession(roomCode: string): GameSession | null {
  const key = KEY_PREFIX + roomCode.toUpperCase();
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(key);
      if (raw) return JSON.parse(raw) as GameSession;
    } catch {
      // недоступное хранилище или битый JSON — пробуем следующее
    }
  }
  return null;
}
