import { Accusation, MOTIVE_DESCRIPTORS, PlayerRole } from '@citykiller/shared';
import type { PublicUser } from './auth.service';
import type { UserGameRow } from './persistence.service';

export interface GameSummary {
  id: string;
  roomCode: string;
  finishedAt: string;
  role: PlayerRole;
  won: boolean;
  opponent: string | null;
  motiveId: string;
  killerJob: string;
  killsCount: number;
  turnNumber: number;
  /** Кого и какой мотив назвал детектив; null — обвинения не было */
  accusation: Accusation | null;
  winReason: string | null;
}

export interface MotiveLine {
  motiveId: string;
  title: string;
  games: number;
  wins: number;
}

export interface DetectiveMotiveLine extends MotiveLine {
  /** Сколько раз назвал верную профессию / верный мотив, когда убийца играл этим мотивом */
  jobGuessed: number;
  motiveGuessed: number;
}

export interface ProfileStats {
  login: string;
  memberSince: string;
  total: { games: number; wins: number };
  detective: {
    games: number;
    wins: number;
    accused: number;
    jobGuessed: number;
    motiveGuessed: number;
    bothGuessed: number;
    /** Победы без обвинения: убийца не успел за 6 раундов или дважды отказался убивать */
    winsWithoutAccusation: number;
    byMotive: DetectiveMotiveLine[];
  };
  killer: {
    games: number;
    wins: number;
    avgKills: number;
    byMotive: MotiveLine[];
  };
  recent: GameSummary[];
}

const RECENT_LIMIT = 30;

function motiveTitle(id: string): string {
  return MOTIVE_DESCRIPTORS.find(m => m.id === id)?.title ?? id;
}

function byMotiveSorted<T extends MotiveLine>(map: Map<string, T>): T[] {
  return [...map.values()].sort((a, b) => b.games - a.games || a.title.localeCompare(b.title, 'ru'));
}

/** Статистика кабинета из завершённых партий игрока против людей */
export function computeProfile(user: PublicUser, rows: UserGameRow[]): ProfileStats {
  const summaries: GameSummary[] = [];
  const detMotives = new Map<string, DetectiveMotiveLine>();
  const kilMotives = new Map<string, MotiveLine>();
  let killerKills = 0;
  const det = {
    games: 0,
    wins: 0,
    accused: 0,
    jobGuessed: 0,
    motiveGuessed: 0,
    bothGuessed: 0,
    winsWithoutAccusation: 0
  };
  const kil = { games: 0, wins: 0 };

  for (const row of rows) {
    const state = row.state;
    // одна и та же учётка за обе стороны в одной партии невозможна (сервер не пускает)
    const role: PlayerRole = row.detectiveUserId === user.id ? 'detective' : 'killer';
    const won = state.winner === role;
    const motiveId = state.killer.motiveId;
    const accusation = state.accusation ?? null;
    const killerJob = state.citizens.find(c => c.id === state.killer.citizenId)?.job ?? '—';

    summaries.push({
      id: row.id,
      roomCode: row.roomCode,
      finishedAt: row.updatedAt,
      role,
      won,
      opponent: role === 'detective' ? row.killerName : row.detectiveName,
      motiveId,
      killerJob,
      killsCount: state.killsCount,
      turnNumber: state.turnNumber,
      accusation,
      winReason: state.winReason
    });

    if (role === 'detective') {
      det.games++;
      if (won) det.wins++;
      const line = detMotives.get(motiveId) ?? {
        motiveId,
        title: motiveTitle(motiveId),
        games: 0,
        wins: 0,
        jobGuessed: 0,
        motiveGuessed: 0
      };
      line.games++;
      if (won) line.wins++;
      if (accusation) {
        det.accused++;
        if (accusation.jobCorrect) {
          det.jobGuessed++;
          line.jobGuessed++;
        }
        if (accusation.motiveCorrect) {
          det.motiveGuessed++;
          line.motiveGuessed++;
        }
        if (accusation.jobCorrect && accusation.motiveCorrect) det.bothGuessed++;
      } else if (won) {
        det.winsWithoutAccusation++;
      }
      detMotives.set(motiveId, line);
    } else {
      kil.games++;
      if (won) kil.wins++;
      killerKills += state.killsCount;
      const line = kilMotives.get(motiveId) ?? { motiveId, title: motiveTitle(motiveId), games: 0, wins: 0 };
      line.games++;
      if (won) line.wins++;
      kilMotives.set(motiveId, line);
    }
  }

  return {
    login: user.login,
    memberSince: user.createdAt,
    total: { games: det.games + kil.games, wins: det.wins + kil.wins },
    detective: { ...det, byMotive: byMotiveSorted(detMotives) },
    killer: {
      ...kil,
      avgKills: kil.games > 0 ? Math.round((killerKills / kil.games) * 10) / 10 : 0,
      byMotive: byMotiveSorted(kilMotives)
    },
    recent: summaries.slice(0, RECENT_LIMIT)
  };
}
