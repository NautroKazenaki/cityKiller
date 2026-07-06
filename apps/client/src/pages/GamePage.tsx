import { Link, useParams } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useGameRoom } from '@/hooks/useGameRoom';
import { DetectiveScreen } from '@/components/game/DetectiveScreen';
import { KillerScreen } from '@/components/game/KillerScreen';

export function GamePage() {
  const { roomCode } = useParams({ from: '/game/$roomCode' });
  const room = useGameRoom(roomCode);

  if (!room.session) {
    return (
      <CenterMessage title="Нет доступа к комнате">
        <p className="text-muted-foreground">
          Данные сессии не найдены. Вернитесь в меню и присоединитесь по коду комнаты.
        </p>
        <Link to="/">
          <Button className="mt-4">В меню</Button>
        </Link>
      </CenterMessage>
    );
  }

  if (room.connectionError) {
    return (
      <CenterMessage title="Ошибка подключения">
        <p className="text-destructive">{room.connectionError}</p>
        <Link to="/">
          <Button className="mt-4">В меню</Button>
        </Link>
      </CenterMessage>
    );
  }

  // Лобби: ждём второго игрока
  if (!room.view) {
    const opponentRole = room.session.role === 'detective' ? 'killer' : 'detective';
    const opponent = room.roomInfo?.players[opponentRole];
    return (
      <CenterMessage title={`Дело № ${room.session.roomCode}`}>
        <div className="space-y-4">
          <p>
            Вы — {room.session.role === 'detective' ? '🕵️ детектив' : '🔪 убийца'} (
            {room.session.username})
          </p>
          <div className="text-5xl font-mono font-bold tracking-[0.3em] border border-primary/40 rounded-lg py-5 select-all text-gold">
            {room.session.roomCode}
          </div>
          <p className="text-muted-foreground text-sm">
            Отправьте этот код второму игроку. Игра начнётся автоматически.
          </p>
          <p className="animate-night-flicker text-muted-foreground">
            {opponent ? `${opponent.username} подключается...` : 'Ожидание второго игрока...'}
          </p>
        </div>
      </CenterMessage>
    );
  }

  const opponentRole = room.session.role === 'detective' ? 'killer' : 'detective';
  const opponentInfo = room.roomInfo?.players[opponentRole];
  const opponentOffline = opponentInfo !== null && opponentInfo !== undefined && !opponentInfo.connected;

  const phase = room.view.phase;

  return (
    <div className="w-screen h-screen bg-noir flex flex-col overflow-hidden">
      <header className="h-12 border-b border-border/60 px-4 flex items-center justify-between shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="font-display font-bold uppercase tracking-widest text-gold">
            City Killer
          </h1>
          <Badge variant="outline" className="font-mono">
            {room.session.roomCode}
          </Badge>
          <Badge
            variant={phase === 'night' ? 'default' : 'secondary'}
            className={phase === 'night' ? 'animate-night-flicker' : ''}
          >
            {phase === 'setup' && '🚔 Расстановка'}
            {phase === 'night' && `🌙 Ночь ${room.view.turnNumber}`}
            {phase === 'relocation' && '🚧 Место преступления'}
            {phase === 'day' && `☀️ День ${room.view.turnNumber}`}
            {phase === 'accusation' && '⚖️ Обвинение'}
            {phase === 'finished' && '🏁 Финал'}
          </Badge>
          {opponentOffline && (
            <Badge variant="destructive" className="animate-pulse">
              Соперник отключился
            </Badge>
          )}
        </div>
        <Link to="/">
          <Button variant="ghost" size="sm">
            В меню
          </Button>
        </Link>
      </header>

      <main className="flex-1 min-h-0 p-3">
        {room.view.role === 'detective' ? (
          <DetectiveScreen
            view={room.view}
            sendCommand={room.sendCommand}
            actionError={room.actionError}
          />
        ) : (
          <KillerScreen
            view={room.view}
            sendCommand={room.sendCommand}
            actionError={room.actionError}
          />
        )}
      </main>

      {/* Конец игры */}
      <Dialog open={room.view.phase === 'finished'}>
        <DialogContent showCloseButton={false} className="noir-panel text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-4xl uppercase tracking-widest text-center text-gold">
              {room.view.winner === room.session.role ? 'Победа' : 'Поражение'}
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              {room.view.winner === room.session.role ? '🏆' : '💀'} {room.view.winReason}
            </DialogDescription>
          </DialogHeader>
          <Link to="/" className="w-full">
            <Button className="w-full font-display uppercase tracking-widest">
              Вернуться в меню
            </Button>
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CenterMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-noir vignette p-4">
      <Card className="max-w-md w-full text-center noir-panel animate-fade-in-up relative z-10">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-widest text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
