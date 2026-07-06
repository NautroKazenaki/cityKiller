// Полная партия через реальный сервер: ночи, расселение, вопросы, обвинение
import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
const connect = () => io(URL, { transports: ['websocket'] });
const emit = (s, ev, p) => new Promise(res => s.emit(ev, p, res));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const det = connect();
const kil = connect();
let detView = null;
let kilView = null;
det.on('game:state', s => (detView = s));
kil.on('game:state', s => (kilView = s));

const created = await emit(det, 'room:create', { username: 'D', role: 'detective' });
const joined = await emit(kil, 'room:join', { roomCode: created.roomCode, username: 'K' });
await sleep(300);

const act = async (socket, token, command) => {
  const r = await emit(socket, 'game:action', {
    roomCode: created.roomCode,
    playerToken: token,
    command
  });
  if (!r.ok) throw new Error(`${command.type}: ${r.error}`);
  await sleep(150);
};

const neighbors = (x, y) =>
  [
    { x, y: y - 1 },
    { x, y: y + 1 },
    { x: x - 1, y },
    { x: x + 1, y }
  ].filter(p => p.x >= 0 && p.x < 4 && p.y >= 0 && p.y < 4);

const aliveIn = (view, x, y) =>
  view.positions.filter(p => p.districtX === x && p.districtY === y && !p.isDead);

await act(det, created.playerToken, { type: 'detective:placeCar', x: 1, y: 1 });

let questionsAsked = 0;
for (let round = 0; round < 30; round++) {
  const phase = kilView.phase;
  if (phase === 'finished' || phase === 'accusation') break;

  if (phase === 'night') {
    const killId = kilView.validKillTargets[0] ?? null;
    const scares = kilView.positions
      .filter(p => !p.isDead && !p.isScared && p.citizenId !== killId)
      .slice(0, 2)
      .map(p => p.citizenId);
    await act(kil, joined.playerToken, { type: 'killer:night', scareIds: scares, killId });
  } else if (phase === 'relocation') {
    const crime = detView.lastCrimeDistrict;
    const stranded = aliveIn(detView, crime.x, crime.y);
    const moves = [];
    const cap = new Map();
    for (const n of neighbors(crime.x, crime.y)) {
      cap.set(`${n.x},${n.y}`, 3 - aliveIn(detView, n.x, n.y).length);
    }
    for (const p of stranded) {
      const t = neighbors(crime.x, crime.y).find(n => cap.get(`${n.x},${n.y}`) > 0);
      cap.set(`${t.x},${t.y}`, cap.get(`${t.x},${t.y}`) - 1);
      moves.push({ citizenId: p.citizenId, toX: t.x, toY: t.y });
    }
    await act(det, created.playerToken, { type: 'detective:relocate', moves });
  } else if (phase === 'day') {
    // Если в районе машины никого нет — едем к соседям с жителями
    let car = detView.detective;
    for (let m = 0; m < 2; m++) {
      if (aliveIn(detView, car.x, car.y).some(p => !p.isScared)) break;
      const dest = neighbors(car.x, car.y).find(n =>
        aliveIn(detView, n.x, n.y).some(p => !p.isScared)
      );
      if (!dest) break;
      await act(det, created.playerToken, { type: 'detective:move', x: dest.x, y: dest.y });
      car = detView.detective;
    }
    const target = aliveIn(detView, car.x, car.y).find(p => !p.isScared);
    if (target && detView.turn.abilitiesLeft > 0) {
      await act(det, created.playerToken, {
        type: 'detective:question',
        citizenId: target.citizenId,
        attribute: 'sex',
        value: 'male'
      });
      const q = kilView.pendingQuestion;
      if (!q) throw new Error('убийца не получил вопрос');
      await act(kil, joined.playerToken, {
        type: 'killer:answer',
        questionId: q.id,
        answer: q.truth
      });
      questionsAsked++;
    }
    await act(det, created.playerToken, { type: 'detective:endTurn' });
  } else {
    await sleep(200);
  }
}

console.log('phase:', kilView.phase, '| kills:', kilView.killsCount, '| вопросов:', questionsAsked);

if (kilView.phase === 'accusation') {
  // Тест: обвиняем правильно (данные берём из вида убийцы)
  const killerJob = kilView.citizens.find(c => c.id === kilView.killer.citizenId).job;
  await act(det, created.playerToken, {
    type: 'detective:accuse',
    job: killerJob,
    motiveId: kilView.killer.motiveId
  });
  console.log('winner:', detView.winner, '|', detView.winReason);
  if (detView.winner !== 'detective') throw new Error('ожидалась победа детектива');
}

console.log('FULL GAME OK');
process.exit(0);
