import { Controller, Get } from '@nestjs/common';
import { PlayerRole } from '@citykiller/shared';
import { LeaderboardRow, PersistenceService } from './persistence.service';
import { BOT_NAME } from './rooms.service';

export interface LeaderboardEntry {
  name: string;
  isBot: boolean;
  games: number;
  wins: number;
  /** Доля побед, 0…1 */
  winRate: number;
}

export interface Leaderboard {
  /** Сколько партий в роли нужно, чтобы попасть в рейтинг */
  minGames: number;
  detectives: LeaderboardEntry[];
  killers: LeaderboardEntry[];
}

/** Одна победа в одной партии — это 100%, но не мастерство: без порога топ занимали бы новички */
export const MIN_GAMES = 3;
const TOP = 5;

/**
 * Рейтинг по ролям. Учитываются игроки с аккаунтом (у гостя нет постоянного
 * имени) — вместе с партиями против бота. Сам бот тоже в рейтинге: его доля
 * побед — это то, насколько трудно людям его обыграть.
 */
export function computeLeaderboard(rows: LeaderboardRow[]): Leaderboard {
  const tally: Record<PlayerRole, Map<string, LeaderboardEntry>> = {
    detective: new Map(),
    killer: new Map()
  };
  const count = (role: PlayerRole, key: string, name: string, isBot: boolean, won: boolean) => {
    const entry = tally[role].get(key) ?? { name, isBot, games: 0, wins: 0, winRate: 0 };
    entry.games++;
    if (won) entry.wins++;
    tally[role].set(key, entry);
  };

  for (const row of rows) {
    const seats: Array<{ role: PlayerRole; userId: string | null; login: string | null }> = [
      { role: 'detective', userId: row.detectiveUserId, login: row.detectiveLogin },
      { role: 'killer', userId: row.killerUserId, login: row.killerLogin }
    ];
    for (const seat of seats) {
      const won = row.winner === seat.role;
      if (row.botRole === seat.role) count(seat.role, `bot:${seat.role}`, BOT_NAME[seat.role], true, won);
      else if (seat.userId && seat.login) count(seat.role, seat.userId, seat.login, false, won);
    }
  }

  const top = (role: PlayerRole) =>
    [...tally[role].values()]
      .filter(e => e.games >= MIN_GAMES)
      .map(e => ({ ...e, winRate: e.wins / e.games }))
      // при равной доле выше тот, кто подтвердил её большим числом партий
      .sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.name.localeCompare(b.name, 'ru'))
      .slice(0, TOP);

  return { minGames: MIN_GAMES, detectives: top('detective'), killers: top('killer') };
}

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly persistence: PersistenceService) {}

  @Get()
  get(): Leaderboard {
    return computeLeaderboard(this.persistence.listLeaderboardRows());
  }
}
