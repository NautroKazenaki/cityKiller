import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { GameCommand, GameState, PlayerRole, applyCommand, killerBot } from '@citykiller/shared';
import { Server, Socket } from 'socket.io';
import { PersistenceService } from './persistence.service';
import { Room, RoomsService } from './rooms.service';

interface CreateRoomDto {
  username: string;
  role: PlayerRole;
  /** Играть против бота: второй слот занимает сервер */
  withBot?: boolean;
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

/** Список origin'ов задаётся через ALLOWED_ORIGINS; по умолчанию — как раньше, любой */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',')
  .map(s => s.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: { origin: ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : '*' }
})
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly rooms: RoomsService,
    private readonly persistence: PersistenceService
  ) {}

  /** Таймеры ходов бота по комнатам — чтобы ходы не наслаивались */
  private readonly botTimers = new Map<string, NodeJS.Timeout>();

  private roomInfo(room: Room) {
    return {
      roomCode: room.roomCode,
      started: room.state !== null,
      players: {
        detective: room.players.detective
          ? {
              username: room.players.detective.username,
              connected:
                room.players.detective.socketId !== null || room.players.detective.isBot === true,
              isBot: room.players.detective.isBot === true
            }
          : null,
        killer: room.players.killer
          ? {
              username: room.players.killer.username,
              connected:
                room.players.killer.socketId !== null || room.players.killer.isBot === true,
              isBot: room.players.killer.isBot === true
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
    const { room, token } = this.rooms.createRoom(
      dto.username,
      dto.role,
      socket.id,
      dto.withBot === true
    );
    if (room.state) {
      // партия против бота стартует сразу — отдадим состояние и запустим его ход
      setTimeout(() => {
        this.broadcastRoom(room);
        this.scheduleBotMove(room);
      }, 50);
    }
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
    this.scheduleBotMove(room);
    return { ok: true as const };
  }

  /**
   * Команда бота для текущего состояния. null — сейчас ходит человек.
   * Решения принимает чистая логика из shared, а применяются они обычным
   * applyCommand: бот физически не может сходить против правил.
   */
  private botCommand(state: GameState, role: PlayerRole): GameCommand | null {
    if (state.phase === 'finished') return null;

    if (role === 'killer') {
      // группа-помощник выбирается до первой ночи; у старых сохранений поля нет
      if (state.allyGroupChosen === false && (state.phase === 'setup' || state.phase === 'night')) {
        const group = killerBot.chooseAllyGroup(state);
        return group ? { type: 'killer:chooseAlly', group } : null;
      }
      if (state.pendingQuestion) {
        return {
          type: 'killer:answer',
          questionId: state.pendingQuestion.id,
          answer: killerBot.decideAnswer(state, state.pendingQuestion)
        };
      }
      if (state.phase === 'night') return killerBot.decideNight(state);
      if (state.phase === 'city' && state.city?.stage === 'killer') {
        if (state.city.emptyGroupNotice) {
          const group = killerBot.chooseReplacementGroup(state);
          return group ? { type: 'city:chooseGroup', group: group as never } : null;
        }
        return killerBot.decideCityMove(state);
      }
    }

    return null;
  }

  /** Пауза перед ходом бота: ожидание должно читаться как обдумывание, а не как лаг */
  private botDelay(command: GameCommand): number {
    if (command.type === 'killer:answer') return 900;
    if (command.type === 'killer:night') return 1600;
    return 700;
  }

  private scheduleBotMove(room: Room): void {
    const existing = this.botTimers.get(room.roomCode);
    if (existing) clearTimeout(existing);

    const role = this.rooms.botRole(room);
    if (!role || !room.state) return;

    const command = this.botCommand(room.state, role);
    if (!command) return;

    const timer = setTimeout(() => {
      this.botTimers.delete(room.roomCode);
      const fresh = this.rooms.getRoom(room.roomCode);
      if (!fresh?.state) return;

      // состояние могло измениться за время паузы — решаем заново
      const next = this.botCommand(fresh.state, role);
      if (!next) return;

      const result = applyCommand(fresh.state, role, next);
      if (!result.ok) {
        // бот не должен ломать партию: просто пропускаем ход и пишем в лог сервера
        console.warn(`[bot:${role}] ход отклонён: ${result.error}`);
        return;
      }

      fresh.state = result.state;
      this.persistence.logAction(fresh.state.id, role, next);
      this.rooms.saveRoom(fresh);
      this.broadcastRoom(fresh);
      // бот может ходить несколько раз подряд: ночь, потом фаза Города
      this.scheduleBotMove(fresh);
    }, this.botDelay(command));

    this.botTimers.set(room.roomCode, timer);
  }

  handleDisconnect(socket: Socket): void {
    const found = this.rooms.markDisconnected(socket.id);
    if (found) {
      this.broadcastRoom(found.room);
    }
  }
}
