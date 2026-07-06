// Дымовой тест: две роли играют полный цикл через реальный сервер
import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';

function connect() {
  return io(URL, { transports: ['websocket'] });
}

function emit(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

function waitFor(socket, event) {
  return new Promise(resolve => socket.once(event, resolve));
}

const detective = connect();
const killer = connect();

const detectiveStates = [];
const killerStates = [];
detective.on('game:state', s => detectiveStates.push(s));
killer.on('game:state', s => killerStates.push(s));

const created = await emit(detective, 'room:create', { username: 'Дет', role: 'detective' });
console.log('create:', created.ok, created.roomCode);
if (!created.ok) process.exit(1);

const joined = await emit(killer, 'room:join', { roomCode: created.roomCode, username: 'Уб' });
console.log('join:', joined.ok, 'role:', joined.role);
if (!joined.ok || joined.role !== 'killer') process.exit(1);

// Ждём стартовые состояния
await new Promise(r => setTimeout(r, 300));
const dv = detectiveStates.at(-1);
const kv = killerStates.at(-1);
console.log('detective view phase:', dv?.phase, '| killer hidden from detective:', dv?.killer === undefined);
console.log('killer view phase:', kv?.phase, '| killer id known:', typeof kv?.killer?.citizenId === 'number');

// Детектив ставит машину
const placed = await emit(detective, 'game:action', {
  roomCode: created.roomCode,
  playerToken: created.playerToken,
  command: { type: 'detective:placeCar', x: 1, y: 1 }
});
console.log('placeCar:', placed.ok);

await new Promise(r => setTimeout(r, 300));
const nightView = killerStates.at(-1);
console.log('night phase:', nightView.phase, '| valid targets:', nightView.validKillTargets.length);

// Убийца делает ночь
const killId = nightView.validKillTargets[0] ?? null;
const scares = nightView.positions
  .filter(p => !p.isDead && !p.isScared && p.citizenId !== killId)
  .slice(0, 2)
  .map(p => p.citizenId);
const night = await emit(killer, 'game:action', {
  roomCode: created.roomCode,
  playerToken: joined.playerToken,
  command: { type: 'killer:night', scareIds: scares, killId }
});
console.log('night action:', night.ok, night.error ?? '');

await new Promise(r => setTimeout(r, 300));
const afterNight = detectiveStates.at(-1);
console.log('after night phase:', afterNight.phase, '| kills:', afterNight.killsCount);

// Проверка чужого хода: убийца пытается ходить машиной
const cheat = await emit(killer, 'game:action', {
  roomCode: created.roomCode,
  playerToken: joined.playerToken,
  command: { type: 'detective:move', x: 1, y: 2 }
});
console.log('cheat rejected:', !cheat.ok, '|', cheat.error);

// Переподключение детектива
detective.disconnect();
const detective2 = connect();
const statePromise = waitFor(detective2, 'game:state');
const rejoined = await emit(detective2, 'room:rejoin', {
  roomCode: created.roomCode,
  playerToken: created.playerToken
});
const stateAfterRejoin = await statePromise;
console.log('rejoin:', rejoined.ok, '| state received:', stateAfterRejoin.phase);

console.log('SMOKE OK');
process.exit(0);
