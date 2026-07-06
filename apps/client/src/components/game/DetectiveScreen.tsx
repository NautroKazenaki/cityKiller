import { useMemo, useState } from 'react';
import type {
  CitizenGroup,
  DetectiveView,
  GameCommand,
  QuestionAttribute,
  QuestionValue
} from '@citykiller/shared';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  MAX_CITIZENS_PER_DISTRICT,
  getNeighbors
} from '@citykiller/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BoardView } from './BoardView';
import { CitizensSheet } from './CitizensSheet';
import { LogPanel } from './LogPanel';
import { QuestionDialog } from './QuestionDialog';
import { AccuseDialog } from './AccuseDialog';
import { ALL_GROUPS_LABELED } from './groups';
import { BUILDING_EMOJI, BUILDING_LABELS, districtName } from '@/lib/labels';

type Mode = 'idle' | 'move' | 'question' | 'police' | 'hospital' | 'diner' | 'fire';

interface DetectiveScreenProps {
  view: DetectiveView;
  sendCommand: (command: GameCommand) => Promise<boolean>;
  actionError: string | null;
}

export function DetectiveScreen({ view, sendCommand, actionError }: DetectiveScreenProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [questionTarget, setQuestionTarget] = useState<{ citizenId: number; viaDiner: boolean } | null>(null);
  const [accuseOpen, setAccuseOpen] = useState(false);

  // Расселение с места преступления
  const [relocAssignments, setRelocAssignments] = useState<Record<number, { x: number; y: number }>>({});
  const [relocSelected, setRelocSelected] = useState<number | null>(null);

  // Эффект пожарных
  const [fireGroup, setFireGroup] = useState<CitizenGroup | null>(null);
  const [fireMoves, setFireMoves] = useState<Record<number, { x: number; y: number }>>({});
  const [fireSelected, setFireSelected] = useState<number | null>(null);

  const alivePositions = useMemo(() => view.positions.filter(p => !p.isDead), [view.positions]);
  const car = view.detective;
  const currentBuilding = car
    ? view.buildings.find(b => b.districtX === car.x && b.districtY === car.y)
    : undefined;

  const strandedCitizens = useMemo(() => {
    if (view.phase !== 'relocation' || !view.lastCrimeDistrict) return [];
    return alivePositions.filter(
      p =>
        p.districtX === view.lastCrimeDistrict!.x && p.districtY === view.lastCrimeDistrict!.y
    );
  }, [view.phase, view.lastCrimeDistrict, alivePositions]);

  const resetModes = () => {
    setMode('idle');
    setFireGroup(null);
    setFireMoves({});
    setFireSelected(null);
  };

  // ==== Что подсвечивать на доске ====
  const highlightDistricts = useMemo((): Array<{ x: number; y: number }> => {
    if (view.phase === 'setup') {
      const all: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) all.push({ x, y });
      }
      return all;
    }
    if (view.phase === 'relocation' && relocSelected !== null && view.lastCrimeDistrict) {
      const crime = view.lastCrimeDistrict;
      return getNeighbors(crime.x, crime.y).filter(n => {
        const current = alivePositions.filter(
          p => p.districtX === n.x && p.districtY === n.y
        ).length;
        const incoming = Object.entries(relocAssignments).filter(
          ([id, d]) => Number(id) !== relocSelected && d.x === n.x && d.y === n.y
        ).length;
        return current + incoming < MAX_CITIZENS_PER_DISTRICT;
      });
    }
    if (view.phase === 'day' && mode === 'move' && car && view.turn.movesLeft > 0) {
      return getNeighbors(car.x, car.y);
    }
    if (view.phase === 'day' && mode === 'fire' && fireSelected !== null) {
      const pos = view.positions.find(p => p.citizenId === fireSelected)!;
      return getNeighbors(pos.districtX, pos.districtY);
    }
    return [];
  }, [view, mode, car, relocSelected, relocAssignments, alivePositions, fireSelected]);

  const selectableCitizenIds = useMemo((): number[] => {
    if (view.phase === 'relocation') {
      return strandedCitizens
        .filter(p => relocAssignments[p.citizenId] === undefined)
        .map(p => p.citizenId);
    }
    if (view.phase !== 'day') return [];
    switch (mode) {
      case 'question':
        if (!car) return [];
        return alivePositions
          .filter(p => p.districtX === car.x && p.districtY === car.y && !p.isScared)
          .map(p => p.citizenId);
      case 'police':
        return alivePositions.map(p => p.citizenId);
      case 'hospital':
        return alivePositions.filter(p => p.isScared).map(p => p.citizenId);
      case 'diner': {
        if (!currentBuilding) return [];
        const neighbors = getNeighbors(currentBuilding.districtX, currentBuilding.districtY);
        return alivePositions
          .filter(
            p =>
              !p.isScared &&
              neighbors.some(n => n.x === p.districtX && n.y === p.districtY)
          )
          .map(p => p.citizenId);
      }
      case 'fire': {
        if (!fireGroup) return [];
        const groupIds = view.citizens.filter(c => c.group === fireGroup).map(c => c.id);
        return alivePositions.filter(p => groupIds.includes(p.citizenId)).map(p => p.citizenId);
      }
      default:
        return [];
    }
  }, [view, mode, car, alivePositions, strandedCitizens, relocAssignments, currentBuilding, fireGroup]);

  // ==== Обработчики доски ====
  const handleDistrictClick = async (x: number, y: number) => {
    if (view.phase === 'setup') {
      await sendCommand({ type: 'detective:placeCar', x, y });
      return;
    }
    if (view.phase === 'relocation' && relocSelected !== null) {
      setRelocAssignments(prev => ({ ...prev, [relocSelected]: { x, y } }));
      setRelocSelected(null);
      return;
    }
    if (mode === 'move') {
      const ok = await sendCommand({ type: 'detective:move', x, y });
      if (ok) setMode('idle');
      return;
    }
    if (mode === 'fire' && fireSelected !== null) {
      setFireMoves(prev => ({ ...prev, [fireSelected]: { x, y } }));
      setFireSelected(null);
    }
  };

  const handleCitizenClick = async (citizenId: number) => {
    if (view.phase === 'relocation') {
      setRelocSelected(citizenId);
      return;
    }
    switch (mode) {
      case 'question':
        setQuestionTarget({ citizenId, viaDiner: false });
        break;
      case 'diner':
        setQuestionTarget({ citizenId, viaDiner: true });
        break;
      case 'police':
        if (currentBuilding) {
          const ok = await sendCommand({
            type: 'detective:useBuilding',
            buildingId: currentBuilding.id,
            payload: { kind: 'police', citizenId }
          });
          if (ok) resetModes();
        }
        break;
      case 'hospital':
        if (currentBuilding) {
          const ok = await sendCommand({
            type: 'detective:useBuilding',
            buildingId: currentBuilding.id,
            payload: { kind: 'hospital', citizenId }
          });
          if (ok) resetModes();
        }
        break;
      case 'fire':
        setFireSelected(citizenId);
        break;
    }
  };

  const submitQuestion = async (attribute: QuestionAttribute, value: QuestionValue) => {
    if (!questionTarget) return;
    let ok: boolean;
    if (questionTarget.viaDiner && currentBuilding) {
      ok = await sendCommand({
        type: 'detective:useBuilding',
        buildingId: currentBuilding.id,
        payload: { kind: 'diner', citizenId: questionTarget.citizenId, attribute, value }
      });
    } else {
      ok = await sendCommand({
        type: 'detective:question',
        citizenId: questionTarget.citizenId,
        attribute,
        value
      });
    }
    if (ok) {
      setQuestionTarget(null);
      resetModes();
    }
  };

  const submitRelocation = async () => {
    const moves = Object.entries(relocAssignments).map(([citizenId, to]) => ({
      citizenId: Number(citizenId),
      toX: to.x,
      toY: to.y
    }));
    const ok = await sendCommand({ type: 'detective:relocate', moves });
    if (ok) {
      setRelocAssignments({});
      setRelocSelected(null);
    }
  };

  const submitFire = async () => {
    if (!currentBuilding || !fireGroup) return;
    const moves = Object.entries(fireMoves).map(([citizenId, to]) => ({
      citizenId: Number(citizenId),
      toX: to.x,
      toY: to.y
    }));
    const ok = await sendCommand({
      type: 'detective:useBuilding',
      buildingId: currentBuilding.id,
      payload: { kind: 'fire', group: fireGroup, moves }
    });
    if (ok) resetModes();
  };

  // Жетоны, по которым можно спросить в этот ход
  const askableTokens = view.policeTokens.filter(t => {
    const pos = view.positions.find(p => p.citizenId === t.citizenId);
    return t.placedTurn < view.turnNumber && pos && !pos.isDead;
  });

  const buildingUsable =
    currentBuilding !== undefined &&
    !view.turn.usedBuildingIds.includes(currentBuilding.id) &&
    view.turn.abilitiesLeft > 0 &&
    !view.pendingQuestion;

  const canAct = view.phase === 'day' && !view.pendingQuestion;

  return (
    <div className="grid grid-cols-12 gap-4 w-full h-full min-h-0">
      <div className="col-span-8 min-h-0">
        <BoardView
          citizens={view.citizens}
          positions={view.positions}
          buildings={view.buildings}
          detective={view.detective}
          policeTokens={view.policeTokens}
          victims={view.victims}
          highlightDistricts={highlightDistricts}
          onDistrictClick={handleDistrictClick}
          selectableCitizenIds={selectableCitizenIds}
          selectedCitizenIds={[
            ...Object.keys(relocAssignments).map(Number),
            ...Object.keys(fireMoves).map(Number)
          ]}
          markedCitizenId={relocSelected ?? fireSelected}
          onCitizenClick={handleCitizenClick}
        />
      </div>

      <div className="col-span-4 flex flex-col gap-3 min-h-0 overflow-y-auto">
        <Card className="noir-panel animate-fade-in-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between font-display uppercase tracking-wider">
              <span>🕵️ Детектив</span>
              <Badge variant="destructive">Жертв: {view.killsCount}/5</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2 text-sm">
              <Badge variant="outline">Ход {view.turnNumber}</Badge>
              {view.phase === 'day' && (
                <>
                  <Badge variant="secondary">Перемещения: {view.turn.movesLeft}</Badge>
                  <Badge variant="secondary">Возможности: {view.turn.abilitiesLeft}</Badge>
                </>
              )}
            </div>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}

            {view.phase === 'setup' && (
              <p className="text-sm">Кликните по району, чтобы поставить полицейскую машину.</p>
            )}
            {view.phase === 'night' && (
              <p className="text-sm animate-pulse">🌙 Ночь. Убийца делает свой ход...</p>
            )}
            {view.pendingQuestion && (
              <p className="text-sm animate-pulse">Ожидание ответа на вопрос...</p>
            )}

            {view.phase === 'relocation' && (
              <div className="space-y-2 text-sm">
                <p>
                  Расселите жителей с места преступления: кликните жителя, затем соседний район.
                </p>
                {strandedCitizens.map(p => {
                  const citizen = view.citizens.find(c => c.id === p.citizenId)!;
                  const assigned = relocAssignments[p.citizenId];
                  return (
                    <div key={p.citizenId} className="flex items-center gap-2">
                      <span className="font-medium">{citizen.job}</span>
                      {assigned ? (
                        <>
                          <Badge>→ {districtName(assigned.x, assigned.y)}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRelocAssignments(prev => {
                                const next = { ...prev };
                                delete next[p.citizenId];
                                return next;
                              })
                            }
                          >
                            ✕
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline">не расселён</Badge>
                      )}
                    </div>
                  );
                })}
                <Button
                  className="w-full"
                  disabled={strandedCitizens.some(p => !relocAssignments[p.citizenId])}
                  onClick={submitRelocation}
                >
                  Подтвердить расселение
                </Button>
              </div>
            )}

            {view.phase === 'day' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={mode === 'move' ? 'default' : 'outline'}
                    disabled={!canAct || view.turn.movesLeft <= 0}
                    onClick={() => setMode(mode === 'move' ? 'idle' : 'move')}
                  >
                    🚔 Переместиться
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === 'question' ? 'default' : 'outline'}
                    disabled={!canAct || view.turn.abilitiesLeft <= 0}
                    onClick={() => setMode(mode === 'question' ? 'idle' : 'question')}
                  >
                    ❓ Задать вопрос
                  </Button>
                </div>

                {currentBuilding && (
                  <div className="rounded-md border p-2 space-y-2">
                    <p className="text-sm font-medium">
                      {BUILDING_EMOJI[currentBuilding.type]} {BUILDING_LABELS[currentBuilding.type]}
                    </p>
                    {currentBuilding.type === 'fire' ? (
                      mode !== 'fire' ? (
                        <div className="flex flex-wrap gap-1">
                          {ALL_GROUPS_LABELED.map(g => (
                            <Button
                              key={g.value}
                              size="sm"
                              variant="outline"
                              disabled={!buildingUsable}
                              onClick={() => {
                                setFireGroup(g.value);
                                setFireMoves({});
                                setMode('fire');
                              }}
                            >
                              {g.label}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1 text-sm">
                          <p>
                            Кликните жителя группы, затем соседний район. Можно оставить всех на
                            месте.
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={submitFire}>
                              Применить
                            </Button>
                            <Button size="sm" variant="outline" onClick={resetModes}>
                              Отмена
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant={
                          mode === currentBuilding.type ? 'default' : 'outline'
                        }
                        disabled={!buildingUsable}
                        onClick={() =>
                          setMode(mode === currentBuilding.type ? 'idle' : (currentBuilding.type as Mode))
                        }
                      >
                        {currentBuilding.type === 'police' && 'Положить жетон на жителя'}
                        {currentBuilding.type === 'hospital' && 'Снять испуг с жителя'}
                        {currentBuilding.type === 'diner' && 'Спросить жителя в соседнем районе'}
                      </Button>
                    )}
                  </div>
                )}

                {askableTokens.length > 0 && (
                  <div className="rounded-md border p-2 space-y-1">
                    <p className="text-sm font-medium">🔵 Жетоны (честный ответ):</p>
                    {askableTokens.map(t => {
                      const citizen = view.citizens.find(c => c.id === t.citizenId)!;
                      return (
                        <Button
                          key={t.citizenId}
                          size="sm"
                          variant="outline"
                          className="w-full justify-start"
                          disabled={!canAct || view.turn.abilitiesLeft <= 0}
                          onClick={() =>
                            sendCommand({ type: 'detective:policeQuestion', citizenId: t.citizenId })
                          }
                        >
                          Можешь ли ты убить жителя {citizen.job}?
                        </Button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    disabled={!canAct}
                    onClick={() => sendCommand({ type: 'detective:endTurn' })}
                  >
                    Закончить ход 🌙
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!canAct}
                    onClick={() => setAccuseOpen(true)}
                  >
                    Обвинить!
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <CitizensSheet
          citizens={view.citizens}
          positions={view.positions}
          answers={view.answers}
          policeAnswers={view.policeAnswers}
        />

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

      <QuestionDialog
        citizen={
          questionTarget
            ? view.citizens.find(c => c.id === questionTarget.citizenId) ?? null
            : null
        }
        viaDiner={questionTarget?.viaDiner ?? false}
        onSubmit={submitQuestion}
        onClose={() => setQuestionTarget(null)}
      />

      <AccuseDialog
        open={accuseOpen || view.phase === 'accusation'}
        forced={view.phase === 'accusation'}
        citizens={view.citizens.filter(c => {
          const pos = view.positions.find(p => p.citizenId === c.id);
          return pos && !pos.isDead;
        })}
        motiveOptions={view.motiveOptions}
        onSubmit={(job, motiveId) => {
          void sendCommand({ type: 'detective:accuse', job, motiveId });
          setAccuseOpen(false);
        }}
        onClose={() => setAccuseOpen(false)}
      />
    </div>
  );
}
