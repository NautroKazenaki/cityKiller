import type { PlayerRole } from '@citykiller/shared';

export interface GameSession {
  roomCode: string;
  playerToken: string;
  role: PlayerRole;
  username: string;
}

const KEY_PREFIX = 'citykiller-session-';

export function saveSession(session: GameSession): void {
  localStorage.setItem(KEY_PREFIX + session.roomCode.toUpperCase(), JSON.stringify(session));
}

export function loadSession(roomCode: string): GameSession | null {
  const raw = localStorage.getItem(KEY_PREFIX + roomCode.toUpperCase());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameSession;
  } catch {
    return null;
  }
}
