import { useQuery } from '@tanstack/react-query';
import { FONT, P } from '@/design/tokens';
import { SERVER_URL } from '@/lib/socket';

interface Entry {
  name: string;
  isBot: boolean;
  games: number;
  wins: number;
  winRate: number;
}

/** Зеркало Leaderboard с сервера (apps/server/src/leaderboard.ts) */
interface LeaderboardData {
  minGames: number;
  detectives: Entry[];
  killers: Entry[];
}

const INK = {
  primary: P.ink,
  secondary: 'oklch(0.72 0.014 80)',
  muted: 'oklch(0.56 0.014 80)'
};

export function useLeaderboard(enabled = true) {
  return useQuery({
    queryKey: ['leaderboard'],
    enabled,
    retry: false,
    queryFn: async (): Promise<LeaderboardData> => {
      const res = await fetch(`${SERVER_URL}/leaderboard`);
      if (!res.ok) throw new Error('Сервер недоступен');
      return res.json();
    }
  });
}

function Board({
  title,
  entries,
  me,
  minGames
}: {
  title: string;
  entries: Entry[];
  me: string | null;
  minGames: number;
}) {
  return (
    <div>
      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.22em', color: P.gold, marginBottom: 8 }}>
        {title}
      </div>
      {entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: INK.muted }}>
          Пока пусто: в рейтинг попадают от {minGames} партий в этой роли.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map((e, i) => {
            const mine = !e.isBot && me !== null && e.name === me;
            return (
              <div
                key={`${e.isBot}-${e.name}`}
                title={`${e.wins} побед из ${e.games}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '22px minmax(0, 1fr) 64px 46px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 3,
                  border: `1px solid ${mine ? 'oklch(0.48 0.1 76)' : 'oklch(0.28 0.014 55)'}`,
                  background: mine ? 'oklch(0.27 0.04 78 / .55)' : 'oklch(0.21 0.012 55)'
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 18,
                    fontWeight: 800,
                    color: i === 0 ? P.gold : INK.secondary,
                    textAlign: 'center'
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: INK.primary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {e.name}
                  </span>
                  {e.isBot && (
                    <span
                      style={{
                        flexShrink: 0,
                        fontFamily: FONT.mono,
                        fontSize: 9,
                        letterSpacing: '0.12em',
                        padding: '1px 5px',
                        borderRadius: 2,
                        border: '1px solid oklch(0.38 0.015 55)',
                        color: INK.secondary
                      }}
                    >
                      БОТ
                    </span>
                  )}
                  {mine && (
                    <span style={{ flexShrink: 0, fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.12em', color: P.gold }}>
                      ВЫ
                    </span>
                  )}
                </span>
                {/* доля побед: тонкая полоса одного тона, число — рядом текстом */}
                <span style={{ height: 6, borderRadius: 3, background: 'oklch(0.28 0.014 55)', overflow: 'hidden' }}>
                  <span
                    style={{
                      display: 'block',
                      width: `${e.winRate * 100}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: 'oklch(0.72 0.11 78)'
                    }}
                  />
                </span>
                <span style={{ textAlign: 'right', lineHeight: 1.1 }}>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: FONT.mono,
                      fontSize: 13,
                      fontWeight: 600,
                      color: INK.primary,
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {Math.round(e.winRate * 100)}%
                  </span>
                  <span style={{ display: 'block', fontFamily: FONT.mono, fontSize: 10, color: INK.muted }}>
                    {e.wins}/{e.games}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Рейтинг: топ-5 детективов и топ-5 убийц по доле побед. Партии против бота
 * считаются, сам бот — тоже участник. Нужен аккаунт: у гостя нет постоянного имени.
 */
export function Leaderboard({ me, enabled = true }: { me: string | null; enabled?: boolean }) {
  const board = useLeaderboard(enabled);

  if (board.isLoading) {
    return <p style={{ margin: 0, fontSize: 12.5, color: INK.muted }}>Загрузка…</p>;
  }
  if (board.isError || !board.data) {
    return (
      <p style={{ margin: 0, fontSize: 12.5, color: INK.muted }}>
        Сервер недоступен — рейтинг появится после его запуска.
      </p>
    );
  }
  const { detectives, killers, minGames } = board.data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Board title="ТОП-5 ДЕТЕКТИВОВ" entries={detectives} me={me} minGames={minGames} />
      <Board title="ТОП-5 УБИЙЦ" entries={killers} me={me} minGames={minGames} />
      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: INK.muted }}>
        По доле побед в роли. Считаются партии игроков с аккаунтом — и против людей, и против бота;
        в рейтинг попадают от {minGames} партий в роли.
      </p>
    </div>
  );
}
