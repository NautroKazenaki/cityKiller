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
    `);
  }

  saveRoom(room: StoredRoom): void {
    this.db
      .prepare(
        `INSERT INTO games (id, room_code, state_json, detective_token, killer_token, detective_name, killer_name, winner, kills_count, turn_number, updated_at)
         VALUES (@id, @roomCode, @stateJson, @detectiveToken, @killerToken, @detectiveName, @killerName, @winner, @killsCount, @turnNumber, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           state_json = @stateJson,
           detective_token = @detectiveToken,
           killer_token = @killerToken,
           detective_name = @detectiveName,
           killer_name = @killerName,
           winner = @winner,
           kills_count = @killsCount,
           turn_number = @turnNumber,
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
        turnNumber: room.state.turnNumber
      });
  }

  logAction(gameId: string, role: string, action: unknown): void {
    this.db
      .prepare('INSERT INTO actions (game_id, role, action_json) VALUES (?, ?, ?)')
      .run(gameId, role, JSON.stringify(action));
  }

  loadUnfinishedRooms(): StoredRoom[] {
    const rows = this.db
      .prepare(
        `SELECT room_code, state_json, detective_token, killer_token, detective_name, killer_name
         FROM games WHERE winner IS NULL`
      )
      .all() as Array<{
      room_code: string;
      state_json: string;
      detective_token: string | null;
      killer_token: string | null;
      detective_name: string | null;
      killer_name: string | null;
    }>;

    return rows.map(row => ({
      roomCode: row.room_code,
      state: JSON.parse(row.state_json) as GameState,
      detectiveToken: row.detective_token,
      killerToken: row.killer_token,
      detectiveName: row.detective_name,
      killerName: row.killer_name
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
