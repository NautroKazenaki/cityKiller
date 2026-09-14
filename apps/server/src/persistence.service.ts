import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { GameState, PlayerRole } from '@citykiller/shared';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface StoredRoom {
  roomCode: string;
  state: GameState;
  detectiveToken: string | null;
  killerToken: string | null;
  detectiveName: string | null;
  killerName: string | null;
  /** Аккаунты игроков; null — гость */
  detectiveUserId: string | null;
  killerUserId: string | null;
  /** Партия против бота — в статистику кабинета не идёт */
  vsBot: boolean;
}

export interface UserRecord {
  id: string;
  login: string;
  passwordHash: string;
  createdAt: string;
}

/** Завершённая партия с участием игрока — сырьё для статистики кабинета */
export interface UserGameRow {
  id: string;
  roomCode: string;
  state: GameState;
  detectiveUserId: string | null;
  killerUserId: string | null;
  detectiveName: string | null;
  killerName: string | null;
  updatedAt: string;
}

export interface GameHistoryEntry {
  id: string;
  roomCode: string;
  winner: PlayerRole | null;
  killsCount: number;
  turnNumber: number;
  updatedAt: string;
}

@Injectable()
export class PersistenceService implements OnModuleDestroy {
  private readonly db: Database.Database;

  constructor() {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.db = new Database(join(dataDir, 'citykiller.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        state_json TEXT NOT NULL,
        detective_token TEXT,
        killer_token TEXT,
        detective_name TEXT,
        killer_name TEXT,
        winner TEXT,
        kills_count INTEGER NOT NULL DEFAULT 0,
        turn_number INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS actions (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        role TEXT NOT NULL,
        action_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        login TEXT NOT NULL,
        login_key TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Базы, созданные до аккаунтов: добавляем колонки, старые партии остаются гостевыми
    const columns = new Set(
      (this.db.prepare('PRAGMA table_info(games)').all() as Array<{ name: string }>).map(c => c.name)
    );
    if (!columns.has('detective_user_id')) this.db.exec('ALTER TABLE games ADD COLUMN detective_user_id TEXT');
    if (!columns.has('killer_user_id')) this.db.exec('ALTER TABLE games ADD COLUMN killer_user_id TEXT');
    if (!columns.has('vs_bot')) this.db.exec('ALTER TABLE games ADD COLUMN vs_bot INTEGER NOT NULL DEFAULT 0');
  }

  saveRoom(room: StoredRoom): void {
    this.db
      .prepare(
        `INSERT INTO games (id, room_code, state_json, detective_token, killer_token, detective_name, killer_name, winner, kills_count, turn_number, detective_user_id, killer_user_id, vs_bot, updated_at)
         VALUES (@id, @roomCode, @stateJson, @detectiveToken, @killerToken, @detectiveName, @killerName, @winner, @killsCount, @turnNumber, @detectiveUserId, @killerUserId, @vsBot, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           state_json = @stateJson,
           detective_token = @detectiveToken,
           killer_token = @killerToken,
           detective_name = @detectiveName,
           killer_name = @killerName,
           winner = @winner,
           kills_count = @killsCount,
           turn_number = @turnNumber,
           detective_user_id = @detectiveUserId,
           killer_user_id = @killerUserId,
           vs_bot = @vsBot,
           updated_at = datetime('now')`
      )
      .run({
        id: room.state.id,
        roomCode: room.roomCode,
        stateJson: JSON.stringify(room.state),
        detectiveToken: room.detectiveToken,
        killerToken: room.killerToken,
        detectiveName: room.detectiveName,
        killerName: room.killerName,
        winner: room.state.winner,
        killsCount: room.state.killsCount,
        turnNumber: room.state.turnNumber,
        detectiveUserId: room.detectiveUserId,
        killerUserId: room.killerUserId,
        vsBot: room.vsBot ? 1 : 0
      });
  }

  // ==== аккаунты ====

  createUser(user: { id: string; login: string; loginKey: string; passwordHash: string }): boolean {
    try {
      this.db
        .prepare('INSERT INTO users (id, login, login_key, password_hash) VALUES (?, ?, ?, ?)')
        .run(user.id, user.login, user.loginKey, user.passwordHash);
      return true;
    } catch {
      // UNIQUE по login_key: логин занят
      return false;
    }
  }

  findUserByLoginKey(loginKey: string): UserRecord | null {
    const row = this.db
      .prepare('SELECT id, login, password_hash, created_at FROM users WHERE login_key = ?')
      .get(loginKey) as { id: string; login: string; password_hash: string; created_at: string } | undefined;
    return row
      ? { id: row.id, login: row.login, passwordHash: row.password_hash, createdAt: row.created_at }
      : null;
  }

  createSession(tokenHash: string, userId: string): void {
    this.db.prepare('INSERT INTO auth_sessions (token_hash, user_id) VALUES (?, ?)').run(tokenHash, userId);
  }

  findUserBySession(tokenHash: string): UserRecord | null {
    const row = this.db
      .prepare(
        `SELECT u.id, u.login, u.password_hash, u.created_at FROM auth_sessions s
         JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
      )
      .get(tokenHash) as { id: string; login: string; password_hash: string; created_at: string } | undefined;
    return row
      ? { id: row.id, login: row.login, passwordHash: row.password_hash, createdAt: row.created_at }
      : null;
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  }

  /** Завершённые партии игрока против живых людей, новые сверху */
  listUserGames(userId: string): UserGameRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, room_code, state_json, detective_user_id, killer_user_id, detective_name, killer_name, updated_at
         FROM games
         WHERE (detective_user_id = @userId OR killer_user_id = @userId)
           AND winner IS NOT NULL AND vs_bot = 0
         ORDER BY updated_at DESC`
      )
      .all({ userId }) as Array<{
      id: string;
      room_code: string;
      state_json: string;
      detective_user_id: string | null;
      killer_user_id: string | null;
      detective_name: string | null;
      killer_name: string | null;
      updated_at: string;
    }>;
    return rows.map(r => ({
      id: r.id,
      roomCode: r.room_code,
      state: JSON.parse(r.state_json) as GameState,
      detectiveUserId: r.detective_user_id,
      killerUserId: r.killer_user_id,
      detectiveName: r.detective_name,
      killerName: r.killer_name,
      updatedAt: r.updated_at
    }));
  }

  logAction(gameId: string, role: string, action: unknown): void {
    this.db
      .prepare('INSERT INTO actions (game_id, role, action_json) VALUES (?, ?, ?)')
      .run(gameId, role, JSON.stringify(action));
  }

  loadUnfinishedRooms(): StoredRoom[] {
    const rows = this.db
      .prepare(
        `SELECT room_code, state_json, detective_token, killer_token, detective_name, killer_name,
                detective_user_id, killer_user_id, vs_bot
         FROM games WHERE winner IS NULL`
      )
      .all() as Array<{
      room_code: string;
      state_json: string;
      detective_token: string | null;
      killer_token: string | null;
      detective_name: string | null;
      killer_name: string | null;
      detective_user_id: string | null;
      killer_user_id: string | null;
      vs_bot: number;
    }>;

    return rows.map(row => ({
      roomCode: row.room_code,
      state: JSON.parse(row.state_json) as GameState,
      detectiveToken: row.detective_token,
      killerToken: row.killer_token,
      detectiveName: row.detective_name,
      killerName: row.killer_name,
      detectiveUserId: row.detective_user_id,
      killerUserId: row.killer_user_id,
      vsBot: row.vs_bot === 1
    }));
  }

  listHistory(limit = 50): GameHistoryEntry[] {
    const rows = this.db
      .prepare(
        `SELECT id, room_code, winner, kills_count, turn_number, updated_at
         FROM games ORDER BY updated_at DESC LIMIT ?`
      )
      .all(limit) as Array<{
      id: string;
      room_code: string;
      winner: PlayerRole | null;
      kills_count: number;
      turn_number: number;
      updated_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      roomCode: row.room_code,
      winner: row.winner,
      killsCount: row.kills_count,
      turnNumber: row.turn_number,
      updatedAt: row.updated_at
    }));
  }

  onModuleDestroy(): void {
    this.db.close();
  }
}
