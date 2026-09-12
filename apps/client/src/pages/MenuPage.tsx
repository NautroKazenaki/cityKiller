import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { PlayerRole } from '@citykiller/shared';
import { emitWithAck, SERVER_URL } from '@/lib/socket';
import { saveSession } from '@/lib/session';
import { FONT, ICON, P } from '@/design/tokens';
import { Icon } from '@/components/game/sheet/Icon';

interface RoomAck {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerToken?: string;
  role?: PlayerRole;
}

interface HistoryEntry {
  id: string;
  roomCode: string;
  winner: PlayerRole | null;
  killsCount: number;
  turnNumber: number;
  updatedAt: string;
}

type Mode = 'bot' | 'create' | 'join';

/** Нож убийцы — собственный глиф, эмодзи в интерфейсе запрещены */
const KNIFE = 'M14 3l7 7-4 4-7-7zM10 8L3 15v6h6l7-7';

const ROLES = [
  {
    role: 'detective' as const,
    title: 'Детектив',
    desc: 'Допросы, жетоны, дедукция. Найти убийцу и мотив за пять ночей.',
    icon: ICON.eye,
    accent: 'oklch(0.62 0.12 250)',
    avBg: 'oklch(0.22 0.03 250)',
    shape: '5px',
    onBd: 'oklch(0.45 0.09 250)',
    onBg: 'oklch(0.24 0.035 250 / .6)',
    onShadow: '0 2px 0 oklch(0.3 0.06 250)',
    onTitle: 'oklch(0.93 0.03 250)',
    onDesc: 'oklch(0.74 0.03 250)'
  },
  {
    role: 'killer' as const,
    title: 'Убийца',
    desc: 'Пугать, лгать и убивать по своему мотиву. Пять жертв — победа.',
    icon: KNIFE,
    accent: 'oklch(0.58 0.16 27)',
    avBg: 'oklch(0.2 0.02 27)',
    shape: '9999px',
    onBd: 'oklch(0.45 0.1 27)',
    onBg: 'oklch(0.24 0.04 27 / .6)',
    onShadow: '0 2px 0 oklch(0.3 0.07 27)',
    onTitle: 'oklch(0.93 0.05 30)',
    onDesc: 'oklch(0.76 0.05 30)'
  }
];

export function MenuPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<PlayerRole>('detective');
  const [mode, setMode] = useState<Mode>('bot');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ['games'],
    queryFn: async (): Promise<HistoryEntry[]> => {
      const res = await fetch(`${SERVER_URL}/games`);
      if (!res.ok) throw new Error('Сервер недоступен');
      return res.json();
    },
    retry: false
  });

  const go = (ack: RoomAck, fallbackRole: PlayerRole) => {
    saveSession({
      roomCode: ack.roomCode!,
      playerToken: ack.playerToken!,
      role: ack.role ?? fallbackRole,
      username: username.trim()
    });
    void navigate({ to: '/game/$roomCode', params: { roomCode: ack.roomCode! } });
  };

  const openCase = async () => {
    if (!username.trim()) {
      setError('Представьтесь: без имени дело не открыть');
      return;
    }
    if (mode === 'join') {
      if (!joinCode.trim()) {
        setError('Введите код дела');
        return;
      }
      const ack = await emitWithAck<RoomAck>('room:join', {
        roomCode: joinCode.trim().toUpperCase(),
        username: username.trim()
      });
      if (!ack.ok || !ack.roomCode || !ack.playerToken || !ack.role) {
        setError(ack.error ?? 'Не удалось подключиться');
        return;
      }
      go(ack, role);
      return;
    }

    const ack = await emitWithAck<RoomAck>('room:create', {
      username: username.trim(),
      role,
      withBot: mode === 'bot'
    });
    if (!ack.ok || !ack.roomCode || !ack.playerToken) {
      setError(ack.error ?? 'Не удалось открыть дело');
      return;
    }
    go(ack, role);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, oklch(0.2 0.012 55), oklch(0.155 0.011 55))',
        fontFamily: FONT.sans,
        color: P.ink,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 28,
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
        {/* ===== ОБЛОЖКА ДЕЛА ===== */}
        <div
          style={{
            width: 512,
            minHeight: 660,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 6,
            background: 'linear-gradient(180deg, oklch(0.2 0.012 55), oklch(0.155 0.011 55))',
            boxShadow: '0 30px 70px -20px rgba(0,0,0,.8), 0 0 0 1px oklch(0.3 0.015 55)',
            display: 'flex',
            flexDirection: 'column',
            padding: 36,
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -140,
              width: 520,
              height: 420,
              transform: 'translateX(-50%)',
              background:
                'radial-gradient(ellipse 50% 50% at 50% 50%, oklch(0.78 0.07 78 / .16), transparent 70%)',
              animation: 'ck-lamp 6s ease-in-out infinite',
              pointerEvents: 'none'
            }}
          />

          <div style={{ position: 'relative' }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: '0.38em',
                color: 'oklch(0.58 0.014 80)'
              }}
            >
              ГОРОД СПИТ · УБИЙЦА НЕТ
            </div>
            <h1
              style={{
                margin: '14px 0 0',
                fontFamily: FONT.display,
                fontSize: 80,
                fontWeight: 800,
                lineHeight: 0.85,
                textTransform: 'uppercase',
                color: P.gold
              }}
            >
              City
              <br />
              Killer
            </h1>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ height: 1, width: 44, background: 'oklch(0.34 0.016 55)' }} />
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: 'oklch(0.62 0.014 80)'
                }}
              >
                ДЕТЕКТИВ ПРОТИВ УБИЙЦЫ
              </span>
            </div>
          </div>

          {/* выбор роли */}
          <div
            style={{
              position: 'relative',
              marginTop: 34,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              opacity: mode === 'join' ? 0.45 : 1,
              transition: 'opacity .18s ease'
            }}
          >
            {ROLES.map(r => {
              const on = role === r.role && mode !== 'join';
              return (
                <button
                  key={r.role}
                  onClick={() => {
                    setRole(r.role);
                    if (mode === 'join') setMode('create');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 18px',
                    borderRadius: 5,
                    border: `1px solid ${on ? r.onBd : 'oklch(0.3 0.015 55)'}`,
                    background: on ? r.onBg : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: on ? r.onShadow : 'none'
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: r.shape,
                      background: r.avBg,
                      border: `2.5px solid ${r.accent}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon path={r.icon} color={r.accent} size={22} width={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: FONT.display,
                        fontSize: 26,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        lineHeight: 1,
                        color: on ? r.onTitle : 'oklch(0.8 0.012 80)'
                      }}
                    >
                      {r.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        color: on ? r.onDesc : 'oklch(0.62 0.014 80)',
                        marginTop: 5
                      }}
                    >
                      {r.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* режим и вход */}
          <div
            style={{
              position: 'relative',
              marginTop: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', gap: 9 }}>
              {(
                [
                  { key: 'bot' as const, label: 'ПРОТИВ БОТА' },
                  { key: 'create' as const, label: 'ПО СЕТИ' },
                  { key: 'join' as const, label: 'ПО КОДУ' }
                ]
              ).map(m => {
                const on = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 4,
                      border: `1px solid ${on ? 'oklch(0.48 0.1 76)' : 'oklch(0.3 0.015 55)'}`,
                      background: on ? 'oklch(0.3 0.05 78)' : 'transparent',
                      color: on ? 'oklch(0.92 0.05 82)' : 'oklch(0.66 0.014 80)',
                      fontFamily: FONT.mono,
                      fontSize: 10.5,
                      letterSpacing: '0.14em',
                      cursor: 'pointer'
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <input
              placeholder="Ваше имя"
              value={username}
              onChange={e => {
                setUsername(e.target.value);
                setError(null);
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 46,
                borderRadius: 4,
                border: '1px solid oklch(0.32 0.016 55)',
                background: 'oklch(0.16 0.011 55)',
                padding: '0 15px',
                fontSize: 15,
                color: 'oklch(0.9 0.012 80)',
                fontFamily: FONT.sans,
                outline: 'none'
              }}
            />

            {mode === 'join' && (
              <input
                placeholder="КОД ДЕЛА"
                value={joinCode}
                maxLength={5}
                onChange={e => {
                  setJoinCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 46,
                  borderRadius: 4,
                  border: '1px solid oklch(0.32 0.016 55)',
                  background: 'oklch(0.16 0.011 55)',
                  padding: '0 15px',
                  fontFamily: FONT.mono,
                  fontSize: 18,
                  letterSpacing: '0.3em',
                  color: P.gold,
                  outline: 'none'
                }}
              />
            )}

            {mode === 'bot' && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'oklch(0.66 0.014 80)'
                }}
              >
                {role === 'detective'
                  ? 'Убийцу ведёт сервер: он выбирает жертву по своему мотиву, пугает жителей и лжёт на допросах.'
                  : 'Бот-детектива пока нет — выберите роль детектива или сыграйте по сети.'}
              </p>
            )}

            <button
              onClick={openCase}
              disabled={mode === 'bot' && role === 'killer'}
              style={{
                width: '100%',
                height: 54,
                borderRadius: 4,
                border: 'none',
                background: 'linear-gradient(180deg, oklch(0.76 0.12 78), oklch(0.66 0.12 76))',
                color: 'oklch(0.2 0.05 60)',
                fontFamily: FONT.display,
                fontSize: 24,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                cursor: 'pointer',
                boxShadow: '0 3px 0 oklch(0.5 0.1 72)'
              }}
            >
              {mode === 'join' ? 'Войти в дело' : mode === 'bot' ? 'Играть против бота' : 'Открыть дело'}
            </button>

            {error && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'oklch(0.85 0.1 30)' }}>{error}</p>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 18 }} />

          <div
            style={{
              position: 'relative',
              fontFamily: FONT.mono,
              fontSize: 9.5,
              letterSpacing: '0.16em',
              color: 'oklch(0.48 0.014 80)',
              display: 'flex',
              justifyContent: 'space-between'
            }}
          >
            <span>ПОСЛЕДНИЕ СВОДКИ · {history.data?.length ?? 0}</span>
            <span>4 × 4 КВАРТАЛА · 20 ЖИТЕЛЕЙ</span>
          </div>
        </div>

        {/* ===== АРХИВ ДЕЛ ===== */}
        <div
          style={{
            width: 420,
            minHeight: 660,
            flexShrink: 0,
            borderRadius: 6,
            background: 'oklch(0.225 0.013 55)',
            border: '1px solid oklch(0.3 0.015 55)',
            boxShadow: '0 1px 0 oklch(0.4 0.02 55 / .22) inset, 0 10px 24px -12px rgba(0,0,0,.7)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '13px 15px',
              borderBottom: '1px solid oklch(0.28 0.015 55)',
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: '0.26em',
              color: 'oklch(0.6 0.014 80)'
            }}
          >
            АРХИВ ПОЛИЦЕЙСКИХ СВОДОК
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {history.isLoading && (
              <p style={{ margin: 0, padding: 15, fontSize: 12.5, color: 'oklch(0.6 0.014 80)' }}>
                Загрузка...
              </p>
            )}
            {history.isError && (
              <p style={{ margin: 0, padding: 15, fontSize: 12.5, color: 'oklch(0.6 0.014 80)' }}>
                Сервер недоступен — сводки появятся после его запуска.
              </p>
            )}
            {history.data?.length === 0 && (
              <p style={{ margin: 0, padding: 15, fontSize: 12.5, color: 'oklch(0.6 0.014 80)' }}>
                В городе пока тихо. Дел не заводили.
              </p>
            )}
            {history.data?.map(game => {
              const look =
                game.winner === 'detective'
                  ? { label: 'РАСКРЫТО', fg: 'oklch(0.8 0.1 150)', accent: 'oklch(0.5 0.12 150)' }
                  : game.winner === 'killer'
                    ? { label: 'УБИЙЦА УШЁЛ', fg: 'oklch(0.82 0.1 30)', accent: P.blood }
                    : { label: 'В РАБОТЕ', fg: 'oklch(0.66 0.014 80)', accent: 'oklch(0.32 0.016 55)' };
              return (
                <div
                  key={game.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '10px 15px',
                    borderBottom: '1px solid oklch(0.26 0.014 55)',
                    borderLeft: `2px solid ${look.accent}`
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      color: P.gold,
                      flexShrink: 0
                    }}
                  >
                    {game.roomCode}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: '0.12em',
                      color: look.fg,
                      flexShrink: 0
                    }}
                  >
                    {look.label}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      color: 'oklch(0.55 0.014 80)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    жертв {game.killsCount} · ход {game.turnNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
