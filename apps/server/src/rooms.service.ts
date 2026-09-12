import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  GameState,
  GameView,
  PlayerRole,
  createGame,
  viewForDetective,
  viewForKiller
} from '@citykiller/shared';
import { randomBytes, randomUUID } from 'crypto';
import { PersistenceService } from './persistence.service';

export interface PlayerSlot {
  token: string;
  username: string;
  socketId: string | null;
  /** Ботом управляет сервер: он не подключается сокетом и всегда «на месте» */
  isBot?: boolean;
}

export interface Room {
  roomCode: string;
  state: GameState | null;
  players: Partial<Record<PlayerRole, PlayerSlot>>;
}

const BOT_NAME: Record<PlayerRole, string> = {
  detective: 'Инспектор Кроу',
  killer: 'Тень'
};

function generateRoomCode(): string {
  // 5 символов без похожих букв
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(5);
  return [...bytes].map(b => alphabet[b % alphabet.length]).join('');
}

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly persistence: PersistenceService) {}

  /** Восстановление незаконченных партий после перезапуска сервера */
  onModuleInit(): void {
    for (const stored of this.persistence.loadUnfinishedRooms()) {
      const room: Room = {
        roomCode: stored.roomCode,
        state: stored.state,
        players: {}
      };
      if (stored.detectiveToken) {
        room.players.detective = {
          token: stored.detectiveToken,
          username: stored.detectiveName ?? 'Детектив',
          socketId: null
        };
      }
      if (stored.killerToken) {
        room.players.killer = {
          token: stored.killerToken,
          username: stored.killerName ?? 'Убийца',
          socketId: null
        };
      }
      this.rooms.set(room.roomCode, room);
    }
  }

  createRoom(
    username: string,
    role: PlayerRole,
    socketId: string,
    withBot = false
  ): { room: Room; token: string } {
    let roomCode = generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }
    const token = randomUUID();
    const room: Room = {
      roomCode,
      state: null,
      players: {
        [role]: { token, username, socketId }
      }
    };

    // Партия против бота начинается сразу: второй слот занимает сервер
    if (withBot) {
      const botRole: PlayerRole = role === 'detective' ? 'killer' : 'detective';
      room.players[botRole] = {
        token: randomUUID(),
        username: BOT_NAME[botRole],
        socketId: null,
        isBot: true
      };
      room.state = createGame(randomUUID());
    }

    this.rooms.set(roomCode, room);
    if (room.state) this.saveRoom(room);
    return { room, token };
  }

  /** Роль, за которую в этой комнате играет бот */
  botRole(room: Room): PlayerRole | null {
    for (const role of ['detective', 'killer'] as PlayerRole[]) {
      if (room.players[role]?.isBot) return role;
    }
    return null;
  }

  joinRoom(
    roomCode: string,
    username: string,
    socketId: string
  ): { room: Room; token: string; role: PlayerRole } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Комната не найдена' };

    const freeRole: PlayerRole | null = !room.players.detective
      ? 'detective'
      : !room.players.killer
        ? 'killer'
        : null;
    if (!freeRole) return { error: 'Комната уже заполнена' };

    const token = randomUUID();
    room.players[freeRole] = { token, username, socketId };

    // Оба игрока на месте — создаём партию
    if (!room.state && room.players.detective && room.players.killer) {
      room.state = createGame(randomUUID());
      this.saveRoom(room);
    }
    return { room, token, role: freeRole };
  }

  rejoin(
    roomCode: string,
    token: string,
    socketId: string
  ): { room: Room; role: PlayerRole } | { error: string } {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return { error: 'Комната не найдена' };
    for (const role of ['detective', 'killer'] as PlayerRole[]) {
      const slot = room.players[role];
      if (slot && slot.token === token) {
        slot.socketId = socketId;
        return { room, role };
      }
    }
    return { error: 'Игрок не найден в этой комнате' };
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  findRoomBySocket(socketId: string): { room: Room; role: PlayerRole } | null {
    for (const room of this.rooms.values()) {
      for (const role of ['detective', 'killer'] as PlayerRole[]) {
        if (room.players[role]?.socketId === socketId) {
          return { room, role };
        }
      }
    }
    return null;
  }

  markDisconnected(socketId: string): { room: Room; role: PlayerRole } | null {
    const found = this.findRoomBySocket(socketId);
    if (found) {
      found.room.players[found.role]!.socketId = null;
    }
    return found;
  }

  viewFor(room: Room, role: PlayerRole): GameView | null {
    if (!room.state) return null;
    return role === 'detective' ? viewForDetective(room.state) : viewForKiller(room.state);
  }

  saveRoom(room: Room): void {
    if (!room.state) return;
    this.persistence.saveRoom({
      roomCode: room.roomCode,
      state: room.state,
      detectiveToken: room.players.detective?.token ?? null,
      killerToken: room.players.killer?.token ?? null,
      detectiveName: room.players.detective?.username ?? null,
      killerName: room.players.killer?.username ?? null
    });
  }
}
