import { io, Socket } from 'socket.io-client';

export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, { transports: ['websocket'] });
  }
  return socket;
}

export function emitWithAck<TResponse>(event: string, payload: unknown): Promise<TResponse> {
  return new Promise(resolve => {
    getSocket().emit(event, payload, (response: TResponse) => resolve(response));
  });
}
