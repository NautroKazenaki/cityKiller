import { useEffect, useMemo, useState } from 'react';
import type { CitizenGroup, GameCommand, KillerView } from '@citykiller/shared';
import { MOTIVE_DESCRIPTORS, SCARES_PER_NIGHT } from '@citykiller/shared';
import { FONT, LAYOUT, P } from '@/design/tokens';
import { GROUP_LABELS, questionText } from '@/lib/labels';
import { moveTargets } from '@/lib/moves';
import { useRevealTraits } from '@/hooks/useRevealTraits';
import { GameSheet } from './sheet/GameSheet';
import type { ChitMarker } from './sheet/Chit';
import { TopBar } from './shell/TopBar';
import { RulesSheet } from '@/components/RulesSheet';
import { LeftColumn } from './shell/LeftColumn';
import { KillerFolder, KillerButton, type NightStep } from './shell/KillerFolder';
import { HintBox } from './shell/ActionRow';
import { AnswerDialog } from './AnswerDialog';

type NightMode = 'kill' | 'scare';

interface KillerScreenProps {
  view: KillerView;
  sendCommand: (command: GameCommand) => Promise<boolean>;
  actionError: string | null;
  roomCode: string;
  myName: string;
  opponentName: string;
  opponentConnected: boolean;
  onMenu: () => void;
}

export function KillerScreen({
  view,
  sendCommand,
  actionError,
  roomCode,
  myName,
  opponentName,
  opponentConnected,
  onMenu
}: KillerScreenProps) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const traits = useRevealTraits();
  // Ночь начинается с испуга: так же пронумерованы шаги в панели, и так честнее —
  // пугать, зная будущую жертву, проще, чем выбирать жертву вслепую
  const [nightMode, setNightMode] = useState<NightMode>('scare');

  // F1 — справка, как и у детектива
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return;
      e.preventDefault();
      setRulesOpen(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [killTarget, setKillTarget] = useState<number | null>(null);
  const [scareTargets, setScareTargets] = useState<number[]>([]);
  const [declineChosen, setDeclineChosen] = useState(false);

  // фаза Города
  const [cityMoves, setCityMoves] = useState<Record<number, { x: number; y: number }>>({});
  const [citySelected, setCitySelected] = useState<number | null>(null);

  const killerCitizen = view.citizens.find(c => c.id === view.killer.citizenId)!;
  const killerPosition = view.positions.find(p => p.citizenId === view.killer.citizenId);
  const motive = MOTIVE_DESCRIPTORS.find(m => m.id === view.killer.motiveId);
  // те же шесть версий, что видит детектив, со своей помеченной
  const motiveCandidates = MOTIVE_DESCRIPTORS.filter(m => view.motiveOptions.includes(m.id)).map(
    m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      mine: m.id === view.killer.motiveId
    })
  );
  const citizenById = (id: number) => view.citizens.find(c => c.id === id)!;
  const posOf = (id: number) => view.positions.find(p => p.citizenId === id);

  const isNight = view.phase === 'night';
  const isCityMyTurn = view.phase === 'city' && view.city?.stage === 'killer';
  // помощников выбирают до первой ночи, пока детектив ставит машину
  const needAlly = !view.allyGroupChosen && (view.phase === 'setup' || view.phase === 'night');
  const allyChoice = needAlly
    ? {
        options: view.allyGroupOptions.map(group => ({
          group,
          members: view.citizens.filter(
            c => c.group === group && c.id !== view.killer.citizenId && !posOf(c.id)?.isDead
          )
        })),
        onChoose: (group: CitizenGroup) => void sendCommand({ type: 'killer:chooseAlly', group })
      }
    : null;

  useEffect(() => {
    setKillTarget(null);
    setScareTargets([]);
    setDeclineChosen(false);
    setNightMode('scare');
    setCityMoves({});
    setCitySelected(null);
  }, [view.phase, view.turnNumber]);

  const scareCandidates = useMemo(
    () =>
      view.positions
        .filter(p => !p.isDead && !p.isScared && p.citizenId !== killTarget)
        .map(p => p.citizenId),
    [view.positions, killTarget]
  );
  const requiredScares = Math.min(SCARES_PER_NIGHT, scareCandidates.length);
  const canDecline = view.validKillTargets.length > 0 && !view.declinedKillUsed;

  const selectableCitizenIds = useMemo((): number[] => {
    if (view.phase === 'city') {
      if (!isCityMyTurn || view.city?.emptyGroupNotice) return [];
      const group = view.city!.group;
      return view.positions
        .filter(p => !p.isDead && citizenById(p.citizenId).group === group)
        .map(p => p.citizenId);
    }
    if (!isNight) return [];
    return nightMode === 'kill' ? view.validKillTargets : scareCandidates;
  }, [view, isNight, nightMode, scareCandidates, isCityMyTurn]);

  // только районы, куда движок действительно пустит: иначе переезд отклонят, а ход встанет
  const availableDistricts = useMemo(() => {
    if (view.phase === 'city' && citySelected !== null) {
      return moveTargets({
        positions: view.positions,
        victims: view.victims,
        citizenId: citySelected,
        moves: cityMoves
      });
    }
    return [];
  }, [view.phase, view.positions, view.victims, citySelected, cityMoves]);

  /** Ночные метки на жетонах: жертва, испуг, своя личность */
  const markers = useMemo((): Record<number, ChitMarker> => {
    const m: Record<number, ChitMarker> = {};
    if (killerPosition && !killerPosition.isDead) m[view.killer.citizenId] = 'self';
    if (isNight) {
      scareTargets.forEach(id => (m[id] = 'scare'));
      if (killTarget !== null) m[killTarget] = 'victim';
    }
    return m;
  }, [view.killer.citizenId, killerPosition, isNight, scareTargets, killTarget]);

  const handleCitizenClick = (citizenId: number) => {
    if (view.phase === 'city') {
      // повторный клик по выбранному — отмена: житель остаётся на месте
      if (citySelected === citizenId) {
        setCitySelected(null);
        setCityMoves(prev => {
          const next = { ...prev };
          delete next[citizenId];
          return next;
        });
      } else {
        setCitySelected(citizenId);
      }
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
        const next = [...prev, citizenId];
        // испуг набран — сразу переводим на шаг 2, лишний клик по вкладке не нужен
        if (next.length === requiredScares) setNightMode('kill');
        return next;
      });
    }
  };

  const handleDistrictClick = (x: number, y: number) => {
    if (view.phase !== 'city' || citySelected === null) return;
    if (!availableDistricts.some(d => d.x === x && d.y === y)) return;
    setCityMoves(prev => ({ ...prev, [citySelected]: { x, y } }));
    setCitySelected(null);
  };

  const canSubmitNight =
    !needAlly &&
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
      setNightMode('scare');
    }
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

  // ==== содержимое панели по фазе ====
  const steps = useMemo((): NightStep[] => {
    if (needAlly) {
      return [
        {
          n: '1',
          text: 'Выбрать группу-помощника',
          state: 'ЖДЁТ',
          done: false
        },
        {
          n: '2',
          text: 'Детектив ставит машину',
          state: view.phase === 'setup' ? 'ЖДЁМ' : 'ГОТОВО',
          done: view.phase !== 'setup'
        }
      ];
    }
    if (isNight) {
      return [
        {
          n: '1',
          text: `Запугать ${requiredScares} ${requiredScares === 1 ? 'жителя' : 'жителей'}`,
          state: `${scareTargets.length}/${requiredScares}`,
          done: scareTargets.length === requiredScares
        },
        {
          n: '2',
          text: declineChosen ? 'Отказ от убийства' : 'Выбрать жертву по мотиву',
          state: declineChosen
            ? 'ОТКАЗ'
            : killTarget !== null
              ? citizenById(killTarget).job.toUpperCase()
              : view.validKillTargets.length === 0
                ? 'НЕКОГО'
                : 'НЕ ВЫБРАНА',
          done: killTarget !== null || declineChosen || view.validKillTargets.length === 0
        },
        {
          n: '3',
          text: 'Подтвердить ночные дела',
          state: canSubmitNight ? 'ГОТОВО' : 'ЖДЁТ',
          done: false
        }
      ];
    }
    if (view.phase === 'city') {
      return [
        {
          n: '1',
          text: isCityMyTurn ? 'Ваш жетон группы' : 'Жетон детектива',
          state: view.city ? GROUP_LABELS[view.city.group].toUpperCase() : '',
          done: isCityMyTurn
        },
        {
          n: '2',
          text: 'Перемещено жителей',
          state: String(Object.keys(cityMoves).length),
          done: Object.keys(cityMoves).length > 0
        }
      ];
    }
    return [
      {
        n: '1',
        text: 'Детектив ведёт расследование',
        state: `ХОД ${view.turnNumber}`,
        done: false
      },
      {
        n: '2',
        text: 'Отвечайте на допросы жителей',
        state: view.pendingQuestion ? 'ВОПРОС' : 'ТИШИНА',
        done: !!view.pendingQuestion
      },
      {
        n: '3',
        text: 'Убийств совершено',
        state: `${view.killsCount}/5`,
        done: view.killsCount > 0
      }
    ];
  }, [
    needAlly,
    isNight,
    requiredScares,
    scareTargets,
    killTarget,
    declineChosen,
    canSubmitNight,
    view,
    isCityMyTurn,
    cityMoves
  ]);

  const phaseBadge =
    view.phase === 'night'
      ? `НОЧЬ ${view.turnNumber}`
      : view.phase === 'day'
        ? `ДЕНЬ ${view.turnNumber}`
        : view.phase === 'city'
          ? 'ГОРОД'
          : view.phase === 'relocation'
            ? 'МЕСТО ПРЕСТ.'
            : view.phase === 'accusation'
              ? 'ОБВИНЕНИЕ'
              : 'РАССТАНОВКА';

  const stepsTitle = needAlly
    ? 'ПОДГОТОВКА К ПЕРВОЙ НОЧИ'
    : isNight
    ? `НОЧНЫЕ ДЕЛА · ${requiredScares} ИСПУГА, 1 ЖЕРТВА`
    : view.phase === 'city'
      ? 'ФАЗА ГОРОДА'
      : 'ЧТО ПРОИСХОДИТ';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, oklch(0.2 0.012 55), oklch(0.165 0.011 55))',
        color: P.ink,
        fontFamily: FONT.sans,
        overflow: 'hidden'
      }}
    >
      {/* ночью лампа над картой гаснет — вместе со слоем ночи это и есть смена фазы */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -160,
          width: 1100,
          height: 620,
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, oklch(0.78 0.07 78 / .17), transparent 70%)',
          pointerEvents: 'none',
          opacity: isNight ? 0 : 1,
          transition: 'opacity .9s ease-in-out',
          animation: 'ck-lamp 6s ease-in-out infinite'
        }}
      />

      <TopBar
        roomCode={roomCode}
        phase={view.phase}
        turnNumber={view.turnNumber}
        killsCount={view.killsCount}
        onMenu={onMenu}
        onRules={() => setRulesOpen(true)}
        traitsOn={traits.reveal}
        onToggleTraits={traits.toggle}
      />

      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: LAYOUT.gap,
          padding: LAYOUT.pad,
          position: 'relative',
          zIndex: 10
        }}
      >
        <LeftColumn
          role="killer"
          phase={view.phase}
          turnNumber={view.turnNumber}
          myName={myName}
          opponentName={opponentName}
          opponentConnected={opponentConnected}
          movesLeft={null}
          abilitiesLeft={null}
          log={view.log}
        />

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start' }}>
          <GameSheet
            gameId={view.id}
            citizens={view.citizens}
            positions={view.positions}
            buildings={view.buildings}
            detective={view.detective}
            policeTokens={view.policeTokens}
            victims={view.victims}
            availableDistricts={availableDistricts}
            onDistrictClick={handleDistrictClick}
            selectableCitizenIds={selectableCitizenIds}
            pendingCitizenIds={Object.keys(cityMoves).map(Number)}
            markers={markers}
            night={isNight}
            revealTraits={traits.reveal}
            onCitizenClick={handleCitizenClick}
          />
        </div>

        <div
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <KillerFolder
              killerCitizen={killerCitizen}
              scared={!!killerPosition?.isScared}
              motiveTitle={motive?.title ?? ''}
              motiveDescription={motive?.description ?? ''}
              motiveCandidates={motiveCandidates}
              allyGroup={view.killer.allyGroup}
              allyChoice={allyChoice}
              phaseBadge={phaseBadge}
              stepsTitle={stepsTitle}
              steps={steps}
            >
              {/* ночь: переключатель цели/испуга и отказ от убийства */}
              {isNight && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 7 }}>
                    {(
                      [
                        {
                          key: 'scare' as const,
                          label: `1 · ИСПУГ ${scareTargets.length}/${requiredScares}`
                        },
                        {
                          key: 'kill' as const,
                          label: `2 · ЖЕРТВА${killTarget !== null ? ' ✓' : ''}`
                        }
                      ]
                    ).map(t => {
                      const on = nightMode === t.key;
                      const blood = t.key === 'kill';
                      return (
                        <button
                          key={t.key}
                          onClick={() => setNightMode(t.key)}
                          style={{
                            flex: 1,
                            height: 36,
                            borderRadius: 4,
                            border: `1px solid ${
                              on
                                ? blood
                                  ? 'oklch(0.5 0.14 27)'
                                  : 'oklch(0.5 0.12 300)'
                                : 'oklch(0.33 0.015 55)'
                            }`,
                            background: on
                              ? blood
                                ? 'oklch(0.32 0.08 27)'
                                : 'oklch(0.3 0.07 300)'
                              : 'oklch(0.26 0.014 55)',
                            color: on
                              ? blood
                                ? 'oklch(0.9 0.1 30)'
                                : 'oklch(0.9 0.08 300)'
                              : 'oklch(0.72 0.014 80)',
                            fontFamily: FONT.mono,
                            fontSize: 10,
                            letterSpacing: '0.14em',
                            cursor: 'pointer'
                          }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {canDecline && (
                    <button
                      onClick={() => {
                        setDeclineChosen(prev => !prev);
                        setKillTarget(null);
                      }}
                      style={{
                        height: 34,
                        borderRadius: 4,
                        border: `1px solid ${
                          declineChosen ? 'oklch(0.5 0.12 78)' : 'oklch(0.33 0.015 55)'
                        }`,
                        background: declineChosen ? 'oklch(0.3 0.05 78)' : 'transparent',
                        color: declineChosen ? 'oklch(0.9 0.08 82)' : 'oklch(0.66 0.014 80)',
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        cursor: 'pointer'
                      }}
                    >
                      {declineChosen ? '✓ ' : ''}ОТКАЗАТЬСЯ ОТ УБИЙСТВА · ОДИН РАЗ ЗА ИГРУ
                    </button>
                  )}
                  {view.declinedKillUsed && (
                    <p
                      style={{
                        margin: 0,
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        color: 'oklch(0.62 0.014 80)'
                      }}
                    >
                      Отказ уже использован — второй означает поражение.
                    </p>
                  )}
                </div>
              )}

              {/* фаза Города: замена пустой группы */}
              {isCityMyTurn && view.city?.emptyGroupNotice && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(Object.keys(GROUP_LABELS) as CitizenGroup[])
                    .filter(
                      g =>
                        g !== view.city!.emptyGroupNotice &&
                        view.citizens.some(c => c.group === g && !posOf(c.id)?.isDead)
                    )
                    .map(g => (
                      <button
                        key={g}
                        onClick={() => chooseCityGroup(g)}
                        style={{
                          height: 30,
                          padding: '0 10px',
                          borderRadius: 3,
                          border: '1px solid oklch(0.36 0.015 55)',
                          background: 'oklch(0.26 0.014 55)',
                          color: 'oklch(0.9 0.012 80)',
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          cursor: 'pointer'
                        }}
                      >
                        {GROUP_LABELS[g].toUpperCase()}
                      </button>
                    ))}
                </div>
              )}
            </KillerFolder>

            {isNight && (
              <HintBox>
                {nightMode === 'kill'
                  ? view.validKillTargets.length > 0
                    ? 'Подсвечены жители, которых разрешают убить ваши правила и мотив. Расстояние до них не имеет значения.'
                    : 'Этой ночью убить некого — правила не позволяют. Выберите только испуг.'
                  : 'Запуганные жители не отвечают на вопросы детектива до конца следующего дня.'}
              </HintBox>
            )}

            {view.phase === 'city' && isCityMyTurn && !view.city?.emptyGroupNotice && (
              <HintBox>
                Кликните жителя своей группы, затем подсвеченный район — туда движок пустит. Повторный
                клик по жителю отменяет его переезд. Можно не двигать никого — жетон всё равно
                вернётся в стопку.
              </HintBox>
            )}

            {view.phase === 'city' && isCityMyTurn && Object.keys(cityMoves).length > 0 && (
              <button
                onClick={() => {
                  setCityMoves({});
                  setCitySelected(null);
                }}
                style={{
                  flexShrink: 0,
                  height: 34,
                  borderRadius: 4,
                  border: '1px solid oklch(0.36 0.015 55)',
                  background: 'transparent',
                  color: 'oklch(0.72 0.014 80)',
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: 'pointer'
                }}
              >
                СБРОСИТЬ ПЕРЕМЕЩЕНИЯ
              </button>
            )}

            {actionError && (
              <div
                style={{
                  flexShrink: 0,
                  padding: '10px 13px',
                  borderRadius: 4,
                  border: '1px solid oklch(0.45 0.1 27)',
                  background: 'oklch(0.26 0.05 27 / .5)',
                  color: 'oklch(0.85 0.1 30)',
                  fontSize: 12.5
                }}
              >
                {actionError}
              </div>
            )}
          </div>

          <div style={{ flexShrink: 0 }}>
            {isNight ? (
              <KillerButton
                label={needAlly ? 'Сначала выберите помощников' : 'Совершить ночные дела'}
                onClick={submitNight}
                disabled={!canSubmitNight}
              />
            ) : view.phase === 'city' ? (
              <KillerButton
                label="Готово"
                onClick={submitCityMove}
                disabled={!isCityMyTurn || !!view.city?.emptyGroupNotice}
              />
            ) : (
              <KillerButton
                label={needAlly ? 'Выберите помощников' : 'Ход детектива'}
                onClick={() => {}}
                disabled
              />
            )}
          </div>
        </div>
      </div>

      <AnswerDialog
        question={view.pendingQuestion}
        citizen={view.pendingQuestion ? citizenById(view.pendingQuestion.citizenId) : null}
        isSelf={view.pendingQuestion?.citizenId === view.killer.citizenId}
        text={view.pendingQuestion ? questionText(view.pendingQuestion.attribute, view.pendingQuestion.value) : ''}
        onAnswer={answer => {
          if (!view.pendingQuestion) return;
          void sendCommand({
            type: 'killer:answer',
            questionId: view.pendingQuestion.id,
            answer
          });
        }}
      />
    </div>
  );
}
