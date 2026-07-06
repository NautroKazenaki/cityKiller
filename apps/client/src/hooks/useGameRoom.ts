import { useCallback, useEffect, useState } from 'react';
import type { GameCommand, GameView, PlayerRole } from '@citykiller/shared';
import { emitWithAck, getSocket } from '@/lib/socket';
import { loadSession, type GameSession } from '@/lib/session';

export interface RoomInfo {
  roomCode: string;
  started: boolean;
  players: {
    detective: { username: string; connected: boolean } | null;
    killer: { username: string; connected: boolean } | null;
  };
}

interface ActionAck {
  ok: boolean;
  error?: string;
}

export interface GameRoom {
  session: GameSession | null;
  roomInfo: RoomInfo | null;
  view: GameView | null;
  connectionError: string | null;
  actionError: string | null;
  clearActionError: () => void;
  sendCommand: (command: GameCommand) => Promise<boolean>;
}

export function useGameRoom(roomCode: string): GameRoom {
  const [session] = useState<GameSession | null>(() => loadSession(roomCode));
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const socket = getSocket();

    const onRoomUpdate = (info: RoomInfo) => setRoomInfo(info);
    const onGameState = (state: GameView) => setView(state);
    socket.on('room:update', onRoomUpdate);
    socket.on('game:state', onGameState);

    const rejoin = async () => {
      const result = await emitWithAck<{ ok: boolean; error?: string; role?: PlayerRole }>(
        'room:rejoin',
        { roomCode: session.roomCode, playerToken: session.playerToken }
      );
      if (!result.ok) {
        setConnectionError(result.error ?? 'Не удалось подключиться к комнате');
      } else {
        setConnectionError(null);
      }
    };

    void rejoin();
    socket.on('connect', rejoin);

    return () => {
      socket.off('room:update', onRoomUpdate);
      socket.off('game:state', onGameState);
      socket.off('connect', rejoin);
    };
  }, [session]);

  const sendCommand = useCallback(
    async (command: GameCommand): Promise<boolean> => {
      if (!session) return false;
      const result = await emitWithAck<ActionAck>('game:action', {
        roomCode: session.roomCode,
        playerToken: session.playerToken,
        command
      });
      if (!result.ok) {
        setActionError(result.error ?? 'Действие отклонено');
        return false;
      }
      setActionError(null);
      return true;
    },
    [session]
  );

  return {
    session,
    roomInfo,
    view,
    connectionError,
    actionError,
    clearActionError: useCallback(() => setActionError(null), []),
    sendCommand
  };
}
