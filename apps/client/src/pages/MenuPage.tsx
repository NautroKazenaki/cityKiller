import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { PlayerRole } from '@citykiller/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { emitWithAck, SERVER_URL } from '@/lib/socket';
import { saveSession } from '@/lib/session';

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

export function MenuPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<PlayerRole>('detective');
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

  const createRoom = async () => {
    if (!username.trim()) {
      setError('Введите имя');
      return;
    }
    const ack = await emitWithAck<RoomAck>('room:create', { username: username.trim(), role });
    if (!ack.ok || !ack.roomCode || !ack.playerToken) {
      setError(ack.error ?? 'Не удалось создать комнату');
      return;
    }
    saveSession({
      roomCode: ack.roomCode,
      playerToken: ack.playerToken,
      role,
      username: username.trim()
    });
    void navigate({ to: '/game/$roomCode', params: { roomCode: ack.roomCode } });
  };

  const joinRoom = async () => {
    if (!username.trim() || !joinCode.trim()) {
      setError('Введите имя и код комнаты');
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
    saveSession({
      roomCode: ack.roomCode,
      playerToken: ack.playerToken,
      role: ack.role,
      username: username.trim()
    });
    void navigate({ to: '/game/$roomCode', params: { roomCode: ack.roomCode } });
  };

  return (
    <div className="w-screen h-screen bg-noir vignette overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8 relative z-10">
        {/* Хиро */}
        <header className="text-center space-y-3 animate-fade-in-up">
          <div className="font-display text-xs tracking-[0.6em] uppercase text-muted-foreground">
            Город спит · Убийца нет
          </div>
          <h1 className="font-display text-7xl font-bold uppercase text-gold leading-none">
            City Killer
          </h1>
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <span className="h-px w-16 bg-border" />
            <p className="font-display tracking-[0.3em] uppercase text-sm">
              Детектив против убийцы
            </p>
            <span className="h-px w-16 bg-border" />
          </div>
        </header>

        {/* Новая игра */}
        <Card className="noir-panel animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="font-display uppercase tracking-widest text-xl">
              Новое дело
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <input
              className="w-full rounded-md border bg-input/40 px-4 py-3 text-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/60"
              placeholder="Ваше имя"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />

            {/* Выбор роли — две карты */}
            <div className="grid grid-cols-2 gap-3">
              <RoleCard
                selected={role === 'detective'}
                emoji="🕵️"
                title="Детектив"
                description="Допросы, жетоны, дедукция. Вычислите убийцу и его мотив."
                accent="police"
                onClick={() => setRole('detective')}
              />
              <RoleCard
                selected={role === 'killer'}
                emoji="🔪"
                title="Убийца"
                description="Пугайте, лгите и убивайте по своему мотиву. 5 жертв — победа."
                accent="blood"
                onClick={() => setRole('killer')}
              />
            </div>

            <Button className="w-full font-display uppercase tracking-widest text-base" size="lg" onClick={createRoom}>
              Создать комнату
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">или</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-md border bg-input/40 px-4 py-3 font-mono text-lg tracking-[0.4em] uppercase placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/60"
                placeholder="Код комнаты"
                value={joinCode}
                maxLength={5}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
              />
              <Button variant="secondary" size="lg" onClick={joinRoom}>
                Войти в дело
              </Button>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </CardContent>
        </Card>

        {/* История */}
        <Card className="noir-panel animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="font-display uppercase tracking-widest text-xl">
              Полицейские сводки
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.isLoading && <p className="text-muted-foreground text-sm">Загрузка...</p>}
            {history.isError && (
              <p className="text-muted-foreground text-sm">
                Сервер недоступен — сводки появятся после его запуска.
              </p>
            )}
            {history.data && history.data.length === 0 && (
              <p className="text-muted-foreground text-sm">В городе пока тихо. Партий не было.</p>
            )}
            <div className="space-y-2">
              {history.data?.map(game => (
                <div
                  key={game.id}
                  className="flex items-center gap-3 text-sm border-b border-border/60 pb-2"
                >
                  <Badge variant="outline" className="font-mono">
                    {game.roomCode}
                  </Badge>
                  <span>
                    {game.winner === 'detective' && '🕵️ Дело раскрыто'}
                    {game.winner === 'killer' && '🔪 Убийца ушёл'}
                    {game.winner === null && '⏳ Расследование идёт'}
                  </span>
                  <span className="text-muted-foreground">
                    жертв: {game.killsCount} · ходов: {game.turnNumber}
                  </span>
                  <span className="text-muted-foreground/60 ml-auto text-xs">
                    {game.updatedAt}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RoleCard({
  selected,
  emoji,
  title,
  description,
  accent,
  onClick
}: {
  selected: boolean;
  emoji: string;
  title: string;
  description: string;
  accent: 'police' | 'blood';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-lg border p-4 space-y-1.5 transition-all duration-200 cursor-pointer',
        'hover:-translate-y-0.5',
        selected
          ? accent === 'police'
            ? 'border-blue-400/70 shadow-[0_0_24px_rgba(59,130,246,0.25)] bg-blue-950/30'
            : 'border-red-400/70 shadow-[0_0_24px_rgba(239,68,68,0.25)] bg-red-950/30'
          : 'border-border bg-secondary/30 hover:border-muted-foreground/50'
      )}
    >
      <div className="text-3xl">{emoji}</div>
      <div className="font-display uppercase tracking-widest font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground leading-snug">{description}</div>
    </button>
  );
}
