import { io, Socket } from 'socket.io-client';

/**
 * Куда стучаться сокету:
 * 1. VITE_SERVER_URL — если сборке явно указали адрес;
 * 2. тот же origin — когда страницу отдал сам сервер (боевой режим, туннель, LAN);
 * 3. localhost:3000 — dev через vite на 5173 и Electron (там origin это file://).
 */
function resolveServerUrl(): string {
  const explicit = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (explicit) return explicit;
  const { protocol, port, origin } = window.location;
  const servedByVite = port === '5173';
  if (protocol.startsWith('http') && !servedByVite) return origin;
  return 'http://localhost:3000';
}

export const SERVER_URL: string = resolveServerUrl();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // polling в резерве: часть корпоративных прокси режет апгрейд до websocket
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function emitWithAck<TResponse>(event: string, payload: unknown): Promise<TResponse> {
  return new Promise(resolve => {
    getSocket().emit(event, payload, (response: TResponse) => resolve(response));
  });
}
