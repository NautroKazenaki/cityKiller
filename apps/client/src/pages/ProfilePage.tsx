import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Accusation, PlayerRole } from '@citykiller/shared';
import { MOTIVE_DESCRIPTORS } from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';
import { clearAuth, fetchProfile, loadAuth } from '@/lib/auth';

interface MotiveLine {
  motiveId: string;
  title: string;
  games: number;
  wins: number;
}

interface DetectiveMotiveLine extends MotiveLine {
  jobGuessed: number;
  motiveGuessed: number;
}

interface GameSummary {
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
  accusation: Accusation | null;
  winReason: string | null;
}

/** Зеркало ProfileStats с сервера (apps/server/src/profile.stats.ts) */
interface ProfileStats {
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
    winsWithoutAccusation: number;
    byMotive: DetectiveMotiveLine[];
  };
  killer: { games: number; wins: number; avgKills: number; byMotive: MotiveLine[] };
  recent: GameSummary[];
}

const INK = {
  primary: P.ink,
  secondary: 'oklch(0.72 0.014 80)',
  muted: 'oklch(0.56 0.014 80)'
};
const GOOD = 'oklch(0.82 0.1 150)';
const BAD = 'oklch(0.8 0.1 30)';

const PANEL: React.CSSProperties = {
  background: 'oklch(0.225 0.013 55)',
  border: '1px solid oklch(0.3 0.015 55)',
  borderRadius: 5,
  boxShadow: '0 1px 0 oklch(0.4 0.02 55 / .22) inset, 0 10px 24px -12px rgba(0,0,0,.7)'
};

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

/** SQLite хранит UTC без зоны: «2026-09-14 17:04:16» */
function formatDate(sqlite: string): string {
  const d = new Date(sqlite.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime())
    ? sqlite
    : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function motiveTitle(id: string): string {
  return MOTIVE_DESCRIPTORS.find(m => m.id === id)?.title ?? id;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.22em', color: P.gold, marginBottom: 10 }}>
      {children}
    </div>
  );
}

/** Плитка-показатель: одно число и подпись, без графика */
function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div
      style={{
        flex: '1 1 150px',
        padding: '13px 15px',
        borderRadius: 4,
        border: '1px solid oklch(0.3 0.015 55)',
        background: 'oklch(0.2 0.012 55)'
      }}
    >
      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.16em', color: INK.muted }}>{label}</div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 36,
          fontWeight: 800,
          lineHeight: 1.05,
          marginTop: 6,
          color: INK.primary,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {value}
      </div>
      {note && <div style={{ fontSize: 12, color: INK.secondary, marginTop: 3 }}>{note}</div>}
    </div>
  );
}

/** Доля побед тонкой полосой одного тона; само число — рядом текстом */
function ShareBar({ part, whole }: { part: number; whole: number }) {
  const share = whole > 0 ? part / whole : 0;
  return (
    <div
      title={`${part} из ${whole} · ${pct(part, whole)}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}
    >
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'oklch(0.28 0.014 55)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${share * 100}%`,
            height: '100%',
            borderRadius: 4,
            background: 'oklch(0.72 0.11 78)'
          }}
        />
      </div>
      <span style={{ fontFamily: FONT.mono, fontSize: 11, color: INK.secondary, width: 36, textAlign: 'right' }}>
        {pct(part, whole)}
      </span>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  const cell: React.CSSProperties = { padding: '8px 10px 8px 0', fontSize: 13, color: INK.primary, verticalAlign: 'middle' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(0.3 0.015 55)' }}>
            {head.map(h => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '0 10px 7px 0',
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  letterSpacing: '0.14em',
                  fontWeight: 400,
                  color: INK.muted,
                  whiteSpace: 'nowrap'
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid oklch(0.26 0.014 55)' }}>
              {r.map((c, j) => (
                <td key={j} style={{ ...cell, fontFamily: j > 0 ? FONT.mono : FONT.sans }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: INK.muted }}>{children}</p>;
}

function Verdict({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span style={{ color: INK.primary }}>
      {text} <span style={{ fontFamily: FONT.mono, fontSize: 10, color: ok ? GOOD : BAD }}>{ok ? 'ВЕРНО' : 'МИМО'}</span>
    </span>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const toMenu = () => void navigate({ to: '/' });
  const auth = loadAuth();

  const profile = useQuery({
    queryKey: ['profile', auth?.token],
    enabled: !!auth,
    retry: false,
    queryFn: async () => {
      try {
        return await fetchProfile<ProfileStats>(auth!.token);
      } catch (e) {
        if ((e as { status?: number }).status === 401) clearAuth();
        throw e;
      }
    }
  });

  const stats = profile.data;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, oklch(0.2 0.012 55), oklch(0.155 0.011 55))',
        fontFamily: FONT.sans,
        color: P.ink,
        boxSizing: 'border-box',
        paddingInline: 28,
        paddingBlock: 28
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.34em', color: INK.muted }}>
              ЛИЧНОЕ ДЕЛО · ТОЛЬКО ПАРТИИ ПРОТИВ ЛЮДЕЙ
            </div>
            <h1
              style={{
                margin: '8px 0 0',
                fontFamily: FONT.display,
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 0.9,
                textTransform: 'uppercase',
                color: P.gold
              }}
            >
              {auth?.user.login ?? 'Кабинет'}
            </h1>
            {stats && (
              <div style={{ fontSize: 12.5, color: INK.secondary, marginTop: 6 }}>
                В городе с {formatDate(stats.memberSince).split(',')[0]}
              </div>
            )}
          </div>
          <button
            onClick={toMenu}
            style={{
              height: 38,
              padding: '0 16px',
              borderRadius: 4,
              border: '1px solid oklch(0.36 0.015 55)',
              background: 'transparent',
              color: INK.secondary,
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: '0.14em',
              cursor: 'pointer'
            }}
          >
            ← В МЕНЮ
          </button>
        </header>

        {!auth && (
          <div style={{ ...PANEL, padding: 20 }}>
            <Empty>Войдите в аккаунт в меню — тогда здесь появится статистика ваших партий.</Empty>
          </div>
        )}
        {profile.isLoading && (
          <div style={{ ...PANEL, padding: 20 }}>
            <Empty>Поднимаем дела из архива…</Empty>
          </div>
        )}
        {profile.isError && (
          <div style={{ ...PANEL, padding: 20 }}>
            <Empty>{(profile.error as Error).message}</Empty>
          </div>
        )}

        {stats && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Tile label="ПАРТИЙ" value={String(stats.total.games)} note="против живых людей" />
              <Tile
                label="ПОБЕД"
                value={pct(stats.total.wins, stats.total.games)}
                note={`${stats.total.wins} из ${stats.total.games}`}
              />
              <Tile
                label="ЗА ДЕТЕКТИВА"
                value={pct(stats.detective.wins, stats.detective.games)}
                note={`${stats.detective.wins} побед из ${stats.detective.games}`}
              />
              <Tile
                label="ЗА УБИЙЦУ"
                value={pct(stats.killer.wins, stats.killer.games)}
                note={`${stats.killer.wins} побед из ${stats.killer.games}`}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 18 }}>
              {/* детектив */}
              <section style={{ ...PANEL, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Label>ДЕТЕКТИВ · ЧТО УГАДЫВАЛ</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -6 }}>
                  <Tile
                    label="ПРОФЕССИЯ"
                    value={pct(stats.detective.jobGuessed, stats.detective.accused)}
                    note={`${stats.detective.jobGuessed} из ${stats.detective.accused} обвинений`}
                  />
                  <Tile
                    label="МОТИВ"
                    value={pct(stats.detective.motiveGuessed, stats.detective.accused)}
                    note={`${stats.detective.motiveGuessed} из ${stats.detective.accused} обвинений`}
                  />
                  <Tile
                    label="ОБА ПУНКТА"
                    value={pct(stats.detective.bothGuessed, stats.detective.accused)}
                    note={`побед без обвинения: ${stats.detective.winsWithoutAccusation}`}
                  />
                </div>
                {stats.detective.byMotive.length === 0 ? (
                  <Empty>За детектива вы ещё не играли против людей.</Empty>
                ) : (
                  <Table
                    head={['НАСТОЯЩИЙ МОТИВ', 'ПАРТИЙ', 'ПРОФЕССИЯ', 'МОТИВ', 'ПОБЕДЫ']}
                    rows={stats.detective.byMotive.map(m => [
                      m.title,
                      m.games,
                      `${m.jobGuessed}/${m.games}`,
                      `${m.motiveGuessed}/${m.games}`,
                      <ShareBar part={m.wins} whole={m.games} />
                    ])}
                  />
                )}
              </section>

              {/* убийца */}
              <section style={{ ...PANEL, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Label>УБИЙЦА · С КАКИМИ МОТИВАМИ</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -6 }}>
                  <Tile label="ПАРТИЙ" value={String(stats.killer.games)} />
                  <Tile label="ПОБЕД" value={String(stats.killer.wins)} note={`поражений: ${stats.killer.games - stats.killer.wins}`} />
                  <Tile label="ЖЕРТВ В СРЕДНЕМ" value={String(stats.killer.avgKills).replace('.', ',')} />
                </div>
                {stats.killer.byMotive.length === 0 ? (
                  <Empty>За убийцу вы ещё не играли против людей.</Empty>
                ) : (
                  <Table
                    head={['МОТИВ', 'ПАРТИЙ', 'ПОБЕД', 'ПОРАЖЕНИЙ', 'ДОЛЯ ПОБЕД']}
                    rows={stats.killer.byMotive.map(m => [
                      m.title,
                      m.games,
                      m.wins,
                      m.games - m.wins,
                      <ShareBar part={m.wins} whole={m.games} />
                    ])}
                  />
                )}
              </section>
            </div>

            {/* последние дела */}
            <section style={{ ...PANEL, padding: 18 }}>
              <Label>ПОСЛЕДНИЕ ДЕЛА</Label>
              {stats.recent.length === 0 ? (
                <Empty>
                  Завершённых партий против людей пока нет. Партии с ботом и гостевые партии в кабинет не
                  попадают.
                </Empty>
              ) : (
                <Table
                  head={['КОГДА', 'РОЛЬ', 'ПРОТИВ', 'ИСХОД', 'ПОДРОБНОСТИ']}
                  rows={stats.recent.map(g => [
                    <span style={{ fontFamily: FONT.mono, fontSize: 11.5, color: INK.secondary }}>
                      {formatDate(g.finishedAt)}
                    </span>,
                    g.role === 'detective' ? 'детектив' : 'убийца',
                    g.opponent ?? '—',
                    <span style={{ color: g.won ? GOOD : BAD }}>{g.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</span>,
                    <span style={{ fontFamily: FONT.sans, fontSize: 12.5, color: INK.secondary, lineHeight: 1.5 }}>
                      {g.role === 'detective' ? (
                        g.accusation ? (
                          <>
                            <Verdict ok={g.accusation.jobCorrect} text={g.accusation.job} /> ·{' '}
                            <Verdict ok={g.accusation.motiveCorrect} text={motiveTitle(g.accusation.motiveId)} />
                            {!(g.accusation.jobCorrect && g.accusation.motiveCorrect) && (
                              <>
                                {' '}
                                — был {g.killerJob}, {motiveTitle(g.motiveId)}
                              </>
                            )}
                          </>
                        ) : (
                          <>без обвинения · убийца {g.killerJob}, {motiveTitle(g.motiveId)}</>
                        )
                      ) : (
                        <>
                          {motiveTitle(g.motiveId)} · жертв {g.killsCount}
                          {g.accusation &&
                            ` · детектив назвал ${g.accusation.job}, ${motiveTitle(g.accusation.motiveId)}`}
                        </>
                      )}
                    </span>
                  ])}
                />
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
