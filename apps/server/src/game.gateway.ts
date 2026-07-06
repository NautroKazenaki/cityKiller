import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { GameCommand, PlayerRole, applyCommand } from '@citykiller/shared';
import { Server, Socket } from 'socket.io';
import { PersistenceService } from './persistence.service';
import { Room, RoomsService } from './rooms.service';

interface CreateRoomDto {
  username: string;
  role: PlayerRole;
}

interface JoinRoomDto {
  roomCode: string;
  username: string;
}

interface RejoinDto {
  roomCode: string;
  playerToken: string;
}

interface ActionDto {
  roomCode: string;
  playerToken: string;
  command: GameCommand;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly rooms: RoomsService,
    private readonly persistence: PersistenceService
  ) {}

  private roomInfo(room: Room) {
    return {
      roomCode: room.roomCode,
      started: room.state !== null,
      players: {
        detective: room.players.detective
          ? {
              username: room.players.detective.username,
              connected: room.players.detective.socketId !== null
            }
          : null,
        killer: room.players.killer
          ? {
              username: room.players.killer.username,
              connected: room.players.killer.socketId !== null
            }
          : null
      }
    };
  }

  /** Отправить каждому игроку его вид состояния + информацию о комнате */
  private broadcastRoom(room: Room): void {
    for (const role of ['detective', 'killer'] as PlayerRole[]) {
      const slot = room.players[role];
      if (!slot?.socketId) continue;
      const socket = this.server.sockets.sockets.get(slot.socketId);
      if (!socket) continue;
      socket.emit('room:update', this.roomInfo(room));
      const view = this.rooms.viewFor(room, role);
      if (view) {
        socket.emit('game:state', view);
      }
    }
  }

  @SubscribeMessage('room:create')
  handleCreate(@MessageBody() dto: CreateRoomDto, @ConnectedSocket() socket: Socket) {
    if (!dto?.username || (dto.role !== 'detective' && dto.role !== 'killer')) {
      return { ok: false as const, error: 'Укажите имя и роль' };
    }
    const { room, token } = this.rooms.createRoom(dto.username, dto.role, socket.id);
    return {
      ok: true as const,
      roomCode: room.roomCode,
      playerToken: token,
      role: dto.role
    };
  }

  @SubscribeMessage('room:join')
  handleJoin(@MessageBody() dto: JoinRoomDto, @ConnectedSocket() socket: Socket) {
    if (!dto?.roomCode || !dto?.username) {
      return { ok: false as const, error: 'Укажите код комнаты и имя' };
    }
    const result = this.rooms.joinRoom(dto.roomCode, dto.username, socket.id);
    if ('error' in result) return { ok: false as const, error: result.error };

    this.broadcastRoom(result.room);
    return {
      ok: true as const,
      roomCode: result.room.roomCode,
      playerToken: result.token,
      role: result.role
    };
  }

  @SubscribeMessage('room:rejoin')
  handleRejoin(@MessageBody() dto: RejoinDto, @ConnectedSocket() socket: Socket) {
    if (!dto?.roomCode || !dto?.playerToken) {
      return { ok: false as const, error: 'Нет данных для переподключения' };
    }
    const result = this.rooms.rejoin(dto.roomCode, dto.playerToken, socket.id);
    if ('error' in result) return { ok: false as const, error: result.error };

    this.broadcastRoom(result.room);
    return { ok: true as const, role: result.role, roomCode: result.room.roomCode };
  }

  @SubscribeMessage('game:action')
  handleAction(@MessageBody() dto: ActionDto) {
    const room = this.rooms.getRoom(dto?.roomCode ?? '');
    if (!room || !room.state) return { ok: false as const, error: 'Игра не найдена' };

    let role: PlayerRole | null = null;
    for (const r of ['detective', 'killer'] as PlayerRole[]) {
      if (room.players[r]?.token === dto.playerToken) role = r;
    }
    if (!role) return { ok: false as const, error: 'Вы не участник этой игры' };

    const result = applyCommand(room.state, role, dto.command);
    if (!result.ok) return { ok: false as const, error: result.error };

    room.state = result.state;
    this.persistence.logAction(room.state.id, role, dto.command);
    this.rooms.saveRoom(room);
    this.broadcastRoom(room);
    return { ok: true as const };
  }

  handleDisconnect(socket: Socket): void {
    const found = this.rooms.markDisconnected(socket.id);
    if (found) {
      this.broadcastRoom(found.room);
    }
  }
}
