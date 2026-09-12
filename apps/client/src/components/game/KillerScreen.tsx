import { useMemo, useState } from 'react';
import type { CitizenGroup, GameCommand, KillerView } from '@citykiller/shared';
import { MOTIVE_DESCRIPTORS, SCARES_PER_NIGHT, getNeighbors } from '@citykiller/shared';
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
import { GameSheet } from './sheet/GameSheet';
import { CitizenCard } from './CitizenCard';
import { LogPanel } from './LogPanel';
import { ALL_GROUPS_LABELED } from './groups';
import { GROUP_LABELS, questionText } from '@/lib/labels';
import { cn } from '@/lib/utils';

type NightMode = 'kill' | 'scare';

interface KillerScreenProps {
  view: KillerView;
  sendCommand: (command: GameCommand) => Promise<boolean>;
  actionError: string | null;
}

export function KillerScreen({ view, sendCommand, actionError }: KillerScreenProps) {
  const [nightMode, setNightMode] = useState<NightMode>('kill');
  const [killTarget, setKillTarget] = useState<number | null>(null);
  const [scareTargets, setScareTargets] = useState<number[]>([]);
  const [declineChosen, setDeclineChosen] = useState(false);

  // Фаза Города: перемещение своей группы
  const [cityMoves, setCityMoves] = useState<Record<number, { x: number; y: number }>>({});
  const [citySelected, setCitySelected] = useState<number | null>(null);

  const killerCitizen = view.citizens.find(c => c.id === view.killer.citizenId)!;
  const killerPosition = view.positions.find(p => p.citizenId === view.killer.citizenId);
  const motive = MOTIVE_DESCRIPTORS.find(m => m.id === view.killer.motiveId);

  const isNight = view.phase === 'night';

  const scareCandidates = useMemo(
    () =>
      view.positions
        .filter(p => !p.isDead && !p.isScared && p.citizenId !== killTarget)
        .map(p => p.citizenId),
    [view.positions, killTarget]
  );
  const requiredScares = Math.min(SCARES_PER_NIGHT, scareCandidates.length);

  const isCityMyTurn = view.phase === 'city' && view.city?.stage === 'killer';

  const selectableCitizenIds = useMemo(() => {
    if (view.phase === 'city') {
      if (!isCityMyTurn || view.city?.emptyGroupNotice) return [];
      const group = view.city!.group;
      return view.positions
        .filter(p => !p.isDead && view.citizens.find(c => c.id === p.citizenId)?.group === group)
        .map(p => p.citizenId);
    }
    if (!isNight) return [];
    return nightMode === 'kill' ? view.validKillTargets : scareCandidates;
  }, [isNight, nightMode, view.validKillTargets, scareCandidates, view.phase, view.city, view.positions, view.citizens, isCityMyTurn]);

  const cityHighlightDistricts = useMemo(() => {
    if (view.phase !== 'city' || citySelected === null) return [];
    const pos = view.positions.find(p => p.citizenId === citySelected);
    return pos ? getNeighbors(pos.districtX, pos.districtY) : [];
  }, [view.phase, view.positions, citySelected]);

  const livingGroupsExcept = (except: CitizenGroup) =>
    ALL_GROUPS_LABELED.filter(
      g =>
        g.value !== except &&
        view.citizens.some(c => {
          if (c.group !== g.value) return false;
          const pos = view.positions.find(p => p.citizenId === c.id);
          return pos !== undefined && !pos.isDead;
        })
    );

  const canDecline = view.validKillTargets.length > 0 && !view.declinedKillUsed;

  const handleCitizenClick = (citizenId: number) => {
    if (view.phase === 'city') {
      setCitySelected(citizenId);
      return;
    }
    if (!isNight) return;
    if (nightMode === 'kill') {
      setKillTarget(prev => (prev === citizenId ? null : citizenId));
      setDeclineChosen(false);
      setScareTargets(prev => prev.filter(id => id !== citizenId));
    } else {
      setScareTargets(prev => {
        if (prev.includes(citizenId)) return prev.filter(id => id !== citizenId);
        if (prev.length >= SCARES_PER_NIGHT) return prev;
        return [...prev, citizenId];
      });
    }
  };

  const handleDistrictClick = (x: number, y: number) => {
    if (view.phase !== 'city' || citySelected === null) return;
    setCityMoves(prev => ({ ...prev, [citySelected]: { x, y } }));
    setCitySelected(null);
  };

  const submitCityMove = async () => {
    const moves = Object.entries(cityMoves).map(([citizenId, to]) => ({
      citizenId: Number(citizenId),
      toX: to.x,
      toY: to.y
    }));
    const ok = await sendCommand({ type: 'city:moveGroup', moves });
    if (ok) {
      setCityMoves({});
      setCitySelected(null);
    }
  };

  const chooseCityGroup = (group: CitizenGroup) => {
    void sendCommand({ type: 'city:chooseGroup', group });
  };

  const canSubmitNight =
    scareTargets.length === requiredScares &&
    (killTarget !== null || view.validKillTargets.length === 0 || declineChosen);

  const submitNight = async () => {
    const ok = await sendCommand({
      type: 'killer:night',
      scareIds: scareTargets,
      killId: declineChosen ? null : killTarget
    });
    if (ok) {
      setKillTarget(null);
      setScareTargets([]);
      setDeclineChosen(false);
      setNightMode('kill');
    }
  };

  const q = view.pendingQuestion;
  const questionCitizen = q ? view.citizens.find(c => c.id === q.citizenId) : null;

  const answer = (value: boolean) => {
    if (!q) return;
    void sendCommand({ type: 'killer:answer', questionId: q.id, answer: value });
  };

  return (
    <div className="grid grid-cols-12 gap-4 w-full h-full min-h-0">
      <div className="col-span-8 min-h-0 flex items-start justify-center overflow-auto">
        <GameSheet
          gameId={view.id}
          citizens={view.citizens}
          positions={view.positions}
          buildings={view.buildings}
          detective={view.detective}
          policeTokens={view.policeTokens}
          victims={view.victims}
          availableDistricts={cityHighlightDistricts}
          onDistrictClick={handleDistrictClick}
          selectableCitizenIds={selectableCitizenIds}
          selectedCitizenIds={view.phase === 'city' ? Object.keys(cityMoves).map(Number) : scareTargets}
          markedCitizenId={view.phase === 'city' ? citySelected : killTarget}
          onCitizenClick={handleCitizenClick}
        />
      </div>

      <div className="col-span-4 flex flex-col gap-3 min-h-0 overflow-y-auto">
        <Card className="noir-panel animate-fade-in-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between font-display uppercase tracking-wider">
              <span>🔪 Убийца</span>
              <Badge variant="destructive">Жертв: {view.killsCount}/5</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CitizenCard
              citizen={killerCitizen}
              isKiller
              isScared={killerPosition?.isScared}
            />
            <div className="text-sm space-y-1">
              <p>
                <span className="font-semibold text-gold">Ваш мотив:</span> {motive?.title} — {motive?.description}
              </p>
              <p>
                <span className="font-semibold">Группа-помощник:</span>{' '}
                {GROUP_LABELS[view.killer.allyGroup]} (за неё можно лгать)
              </p>
            </div>

            <div className="rounded-md border border-border/60 p-2 space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Детектив выбирает из этих {view.motiveOptions.length} мотивов:
              </p>
              <div className="flex flex-col gap-1">
                {MOTIVE_DESCRIPTORS.filter(m => view.motiveOptions.includes(m.id)).map(m => {
                  const real = m.id === view.killer.motiveId;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'text-xs rounded px-2 py-1 border',
                        real
                          ? 'border-gold/70 bg-gold/10 text-gold font-semibold'
                          : 'border-border/40 text-muted-foreground'
                      )}
                    >
                      {real ? '● ' : '○ '}
                      {m.title}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Только один настоящий — остальные сбивают детектива с толку.
              </p>
            </div>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          </CardContent>
        </Card>

        {isNight ? (
          <Card className="noir-panel border-purple-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display uppercase tracking-wider animate-night-flicker">
                🌙 Ночь {view.turnNumber}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={nightMode === 'kill' ? 'destructive' : 'outline'}
                  onClick={() => setNightMode('kill')}
                >
                  Жертва {killTarget !== null ? '✓' : ''}
                </Button>
                <Button
                  size="sm"
                  variant={nightMode === 'scare' ? 'default' : 'outline'}
                  onClick={() => setNightMode('scare')}
                >
                  Испуг ({scareTargets.length}/{requiredScares})
                </Button>
              </div>
              {nightMode === 'kill' && (
                <p className="text-muted-foreground">
                  {view.validKillTargets.length > 0
                    ? 'Подсвечены жители, которых разрешают убить ваши правила и мотив.'
                    : 'Этой ночью убить некого — правила не позволяют. Выберите только испуг.'}
                </p>
              )}
              {nightMode === 'scare' && (
                <p className="text-muted-foreground">
                  Выберите {requiredScares} жителей, которых запугаете (они не смогут отвечать).
                </p>
              )}
              {canDecline && (
                <Button
                  size="sm"
                  variant={declineChosen ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => {
                    setDeclineChosen(prev => !prev);
                    setKillTarget(null);
                  }}
                >
                  {declineChosen ? '✓ ' : ''}Отказаться от убийства этой ночью (доступно один раз за игру)
                </Button>
              )}
              {view.declinedKillUsed && (
                <p className="text-xs text-muted-foreground">
                  Отказ от убийства уже использован в этой партии — второй отказ будет означать поражение.
                </p>
              )}
              <Button className="w-full" disabled={!canSubmitNight} onClick={submitNight}>
                Совершить ночные дела
              </Button>
            </CardContent>
          </Card>
        ) : view.phase === 'city' ? (
          <Card className="noir-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display uppercase tracking-wider">
                🏙️ Фаза Города
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!isCityMyTurn ? (
                <p className="animate-pulse">
                  Ходит Детектив (группа «{view.city ? GROUP_LABELS[view.city.group] : ''}»)...
                </p>
              ) : view.city?.emptyGroupNotice ? (
                <div className="space-y-2">
                  <p>
                    Жетон «{GROUP_LABELS[view.city.emptyGroupNotice]}» — живых представителей не
                    осталось. Выберите другую группу (этот жетон уйдёт из игры навсегда):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {livingGroupsExcept(view.city.emptyGroupNotice).map(g => (
                      <Button
                        key={g.value}
                        size="sm"
                        variant="outline"
                        onClick={() => chooseCityGroup(g.value)}
                      >
                        {g.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>
                    Жетон группы «{view.city ? GROUP_LABELS[view.city.group] : ''}». Кликните
                    жителя группы, затем соседний район. Можно никого не двигать.
                  </p>
                  <Button className="w-full" onClick={submitCityMove}>
                    Готово
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="noir-panel">
            <CardContent className="text-sm py-3">
              {view.phase === 'setup' && 'Детектив выбирает, куда поставить машину...'}
              {view.phase === 'day' && !q && '☀️ День. Детектив ведёт расследование...'}
              {view.phase === 'relocation' && 'Детектив расселяет жителей с места преступления...'}
              {view.phase === 'accusation' && '⚖️ Детектив предъявляет обвинение...'}
            </CardContent>
          </Card>
        )}

        <Card className="flex-1 min-h-32 noir-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display uppercase tracking-wider">
              📻 Сводка
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            <LogPanel log={view.log} />
          </CardContent>
        </Card>
      </div>

      {/* Ответ на вопрос детектива */}
      <Dialog open={q !== null}>
        <DialogContent showCloseButton={false} className="noir-panel">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider">
              🔦 Детектив допрашивает: {questionCitizen?.job}
            </DialogTitle>
            <DialogDescription className="text-lg text-foreground/90">
              «{q ? questionText(q.attribute, q.value) : ''}»
            </DialogDescription>
          </DialogHeader>
          {q?.mustBeHonest ? (
            <div className="space-y-3">
              <p className="text-sm">
                Этот житель не ваш персонаж и не из группы-помощника — отвечать нужно честно.
              </p>
              <Button className="w-full" onClick={() => answer(q.truth)}>
                Ответить честно: «{q.truth ? 'Да' : 'Нет'}»
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-purple-300">
                Это {q?.citizenId === view.killer.citizenId ? 'ВЫ' : 'ваш помощник'} — можно
                солгать! Правдивый ответ: «{q?.truth ? 'Да' : 'Нет'}».
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => answer(true)}>
                  Ответить «Да»
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => answer(false)}>
                  Ответить «Нет»
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
