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
import { AuthService } from './auth.service';
import { BotRunnerService } from './bot-runner.service';
import { PersistenceService } from './persistence.service';
import { Room, RoomsService } from './rooms.service';

interface CreateRoomDto {
  username: string;
  role: PlayerRole;
  /** Играть против бота: второй слот занимает сервер */
  withBot?: boolean;
  /** Вход в аккаунт: партия пойдёт в статистику, имя — логин */
  authToken?: string;
}

interface JoinRoomDto {
  roomCode: string;
  username: string;
  authToken?: string;
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
    private readonly persistence: PersistenceService,
    private readonly auth: AuthService,
    private readonly botRunner: BotRunnerService
  ) {}

  /** Поколение расчёта хода бота по комнатам: решение для устаревшего состояния выбрасываем */
  private readonly botGenerations = new Map<string, number>();

  /**
   * Кто входит в комнату. С токеном — владелец аккаунта, и имя берётся из логина:
   * иначе под чужим именем можно было бы сыграть партию «за него». Протухший
   * токен — ошибка, а не тихий вход гостем: игрок думал бы, что партия считается.
   */
  private identify(
    username: string | undefined,
    authToken: string | undefined
  ): { username: string; userId: string | null } | { error: string } {
    if (authToken) {
      const user = this.auth.userByToken(authToken);
      if (!user) return { error: 'Вход в аккаунт устарел — войдите заново' };
      return { username: user.login, userId: user.id };
    }
    const name = username?.trim();
    if (!name) return { error: 'Укажите имя' };
    return { username: name, userId: null };
  }

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
    if (dto?.role !== 'detective' && dto?.role !== 'killer') {
      return { ok: false as const, error: 'Укажите имя и роль' };
    }
    const who = this.identify(dto.username, dto.authToken);
    if ('error' in who) return { ok: false as const, error: who.error };
    const { room, token } = this.rooms.createRoom(
      who.username,
      dto.role,
      socket.id,
      dto.withBot === true,
      who.userId
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
    if (!dto?.roomCode) {
      return { ok: false as const, error: 'Укажите код комнаты и имя' };
    }
    const who = this.identify(dto.username, dto.authToken);
    if ('error' in who) return { ok: false as const, error: who.error };
    const result = this.rooms.joinRoom(dto.roomCode, who.username, socket.id, who.userId);
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

  /** Пауза перед ходом бота: ожидание должно читаться как обдумывание, а не как лаг */
  private botDelay(command: GameCommand): number {
    if (command.type === 'killer:answer') return 900;
    if (command.type === 'killer:night') return 1600;
    if (command.type === 'detective:accuse') return 1800;
    if (command.type === 'detective:question' || command.type === 'detective:useBuilding') return 1100;
    return 700;
  }

  /**
   * Ход бота. Решение считается в отдельном потоке (BotRunnerService), пауза
   * «на обдумывание» отсчитывается от начала расчёта, так что тяжёлый перебор
   * не удлиняет ожидание. Применяется ход обычным applyCommand: бот физически
   * не может сходить против правил.
   *
   * Каждый новый вызов открывает новое «поколение»: если, пока бот думал,
   * кто-то сходил, устаревшее решение выбрасывается и считается заново.
   */
  private scheduleBotMove(room: Room): void {
    const code = room.roomCode;
    const existing = this.botTimers.get(code);
    if (existing) clearTimeout(existing);
    this.botTimers.delete(code);
    const generation = (this.botGenerations.get(code) ?? 0) + 1;
    this.botGenerations.set(code, generation);

    const role = this.rooms.botRole(room);
    const snapshot = room.state;
    if (!role || !snapshot || snapshot.phase === 'finished') return;

    const startedAt = Date.now();
    void this.botRunner.decide(snapshot, role).then(command => {
      if (!command || this.botGenerations.get(code) !== generation) return;
      const wait = Math.max(0, this.botDelay(command) - (Date.now() - startedAt));

      const timer = setTimeout(() => {
        this.botTimers.delete(code);
        if (this.botGenerations.get(code) !== generation) return;
        const fresh = this.rooms.getRoom(code);
        if (!fresh?.state) return;
        // состояние изменилось, пока бот думал, — решаем заново
        if (fresh.state !== snapshot) {
          this.scheduleBotMove(fresh);
          return;
        }

        let applied: GameCommand = command;
        let result = applyCommand(fresh.state, role, applied);
        if (!result.ok) {
          console.warn(`[bot:${role}] ход отклонён: ${result.error}`);
          // детектив не должен повесить партию на своём дне: закрываем ход и идём дальше
          if (role === 'detective' && fresh.state.phase === 'day' && !fresh.state.pendingQuestion) {
            applied = { type: 'detective:endTurn' };
            result = applyCommand(fresh.state, role, applied);
          }
          if (!result.ok) return;
        }

        fresh.state = result.state;
        this.persistence.logAction(fresh.state.id, role, applied);
        this.rooms.saveRoom(fresh);
        this.broadcastRoom(fresh);
        // бот может ходить несколько раз подряд: ночь, потом фаза Города
        this.scheduleBotMove(fresh);
      }, wait);

      this.botTimers.set(code, timer);
    });
  }

  handleDisconnect(socket: Socket): void {
    const found = this.rooms.markDisconnected(socket.id);
    if (found) {
      this.broadcastRoom(found.room);
    }
  }
}
