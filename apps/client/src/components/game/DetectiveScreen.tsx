import { useEffect, useMemo, useState } from 'react';
import type {
  CitizenGroup,
  DetectiveView,
  GameCommand,
  QuestionAttribute,
  QuestionValue
} from '@citykiller/shared';
import { MAX_CITIZENS_PER_DISTRICT, getNeighbors } from '@citykiller/shared';
import { FONT, LAYOUT, P } from '@/design/tokens';
import { districtTitle } from '@/design/city';
import { GROUP_LABELS, districtName } from '@/lib/labels';
import { EMPTY_FILTER, deduce, type SuspectFilter } from '@/lib/deduction';
import { moveTargets } from '@/lib/moves';
import { useRevealTraits } from '@/hooks/useRevealTraits';
import { GameSheet } from './sheet/GameSheet';
import { TopBar } from './shell/TopBar';
import { RulesSheet } from '@/components/RulesSheet';
import { LeftColumn } from './shell/LeftColumn';
import { CaseFolder, type CitizenState } from './shell/CaseFolder';
import { CaseTabs } from './shell/CaseTabs';
import { SuspectsSheet } from './shell/SuspectsSheet';
import { Journal } from './shell/Journal';
import { MotivesPanel } from './shell/MotivesPanel';
import { DangerButton, HintBox, PrimaryButton, type ActionSpec } from './shell/ActionRow';
import { QuestionDialog } from './QuestionDialog';
import { AccuseDialog } from './AccuseDialog';

/** Режимы выбора цели для эффектов зданий */
type TargetMode = 'idle' | 'police' | 'hospital' | 'diner' | 'fire';

/** Пауза после пятого убийства перед окном обвинения: осмотреть карту и спросить по жетонам */
const ACCUSE_DELAY_S = 10;

/** Убрать запланированный переезд жителя — он остаётся на месте */
function withoutMove<T>(moves: Record<number, T>, citizenId: number): Record<number, T> {
  const next = { ...moves };
  delete next[citizenId];
  return next;
}

interface DetectiveScreenProps {
  view: DetectiveView;
  sendCommand: (command: GameCommand) => Promise<boolean>;
  actionError: string | null;
  roomCode: string;
  myName: string;
  opponentName: string;
  opponentConnected: boolean;
  onMenu: () => void;
}

export function DetectiveScreen({
  view,
  sendCommand,
  actionError,
  roomCode,
  myName,
  opponentName,
  opponentConnected,
  onMenu
}: DetectiveScreenProps) {
  const traits = useRevealTraits();
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [tab, setTab] = useState<'place' | 'journal' | 'motives'>('place');
  const [rulesOpen, setRulesOpen] = useState(false);
  /** Вычеркнутые мотивы — личные пометки детектива, движок о них не знает */
  const [crossedMotives, setCrossedMotives] = useState<string[]>([]);
  const [mode, setMode] = useState<TargetMode>('idle');
  const [questionTarget, setQuestionTarget] = useState<{ citizenId: number; viaDiner: boolean } | null>(null);
  const [accuseOpen, setAccuseOpen] = useState(false);
  /** Ответы, которым детектив не верит, и свой фильтр таблицы — личные пометки */
  const [ignoredAnswers, setIgnoredAnswers] = useState<string[]>([]);
  const [suspectFilter, setSuspectFilter] = useState<SuspectFilter>(EMPTY_FILTER);
  // после пятого убийства: отсчёт до окна обвинения и возможность вернуться к карте
  const [accuseCountdown, setAccuseCountdown] = useState<number | null>(null);
  const [accuseHidden, setAccuseHidden] = useState(false);

  // расселение с места преступления
  const [relocAssignments, setRelocAssignments] = useState<Record<number, { x: number; y: number }>>({});
  const [relocSelected, setRelocSelected] = useState<number | null>(null);

  // пожарные
  const [fireGroup, setFireGroup] = useState<CitizenGroup | null>(null);
  const [fireMoves, setFireMoves] = useState<Record<number, { x: number; y: number }>>({});
  const [fireSelected, setFireSelected] = useState<number | null>(null);

  // фаза Города
  const [cityMoves, setCityMoves] = useState<Record<number, { x: number; y: number }>>({});
  const [citySelected, setCitySelected] = useState<number | null>(null);

  const car = view.detective;
  const alive = useMemo(() => view.positions.filter(p => !p.isDead), [view.positions]);
  const citizenById = (id: number) => view.citizens.find(c => c.id === id)!;
  const posOf = (id: number) => view.positions.find(p => p.citizenId === id);
  const inDistrict = (d: { x: number; y: number } | null) =>
    d ? alive.filter(p => p.districtX === d.x && p.districtY === d.y) : [];

  const currentBuilding = car
    ? view.buildings.find(b => b.districtX === car.x && b.districtY === car.y)
    : undefined;
  const isCityMyTurn = view.phase === 'city' && view.city?.stage === 'detective';

  const strandedCitizens = useMemo(() => {
    if (view.phase !== 'relocation' || !view.lastCrimeDistrict) return [];
    return alive.filter(
      p => p.districtX === view.lastCrimeDistrict!.x && p.districtY === view.lastCrimeDistrict!.y
    );
  }, [view.phase, view.lastCrimeDistrict, alive]);

  // сброс локального выбора при смене фазы
  useEffect(() => {
    setMode('idle');
    setFireGroup(null);
    setFireMoves({});
    setFireSelected(null);
    setCitySelected(null);
    setCityMoves({});
    setRelocSelected(null);
    setRelocAssignments({});
  }, [view.phase, view.turnNumber]);

  // Пятое убийство: окно обвинения открывается не сразу — сначала пауза, чтобы
  // увидеть, где случилось убийство, и спросить по оставшимся жетонам
  useEffect(() => {
    setAccuseHidden(false);
    if (view.phase !== 'accusation') {
      setAccuseCountdown(null);
      return;
    }
    setAccuseCountdown(ACCUSE_DELAY_S);
    const timer = window.setInterval(
      () => setAccuseCountdown(c => (c !== null && c > 0 ? c - 1 : c)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [view.phase]);

  const openAccusation = () => {
    setAccuseCountdown(0);
    setAccuseHidden(false);
  };
  const forcedAccuseOpen = view.phase === 'accusation' && accuseCountdown === 0 && !accuseHidden;

  const deduction = useMemo(
    () => deduce(view.citizens, view.positions, view.answers, ignoredAnswers, suspectFilter),
    [view.citizens, view.positions, view.answers, ignoredAnswers, suspectFilter]
  );
  const toggleAnswer = (id: string) =>
    setIgnoredAnswers(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const journalProps = {
    citizens: view.citizens,
    positions: view.positions,
    answers: view.answers,
    policeAnswers: view.policeAnswers,
    ignoredIds: ignoredAnswers,
    conflictIds: deduction.conflicts,
    onToggleAnswer: toggleAnswer
  };

  const resetModes = () => {
    setMode('idle');
    setFireGroup(null);
    setFireMoves({});
    setFireSelected(null);
  };

  // ==== что подсвечено на листе ====
  const availableDistricts = useMemo((): Array<{ x: number; y: number }> => {
    if (view.phase === 'setup') {
      const all: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) all.push({ x, y });
      return all;
    }
    // Переезды жителей: подсвечиваем только то, что пропустит движок. Раньше карта
    // принимала любой район, сервер отклонял ход, и партия вставала
    if (view.phase === 'relocation' && relocSelected !== null && view.lastCrimeDistrict) {
      return moveTargets({
        positions: view.positions,
        victims: view.victims,
        citizenId: relocSelected,
        moves: relocAssignments,
        relocation: { crime: view.lastCrimeDistrict }
      });
    }
    if (view.phase === 'day' && mode === 'fire' && fireSelected !== null) {
      return moveTargets({
        positions: view.positions,
        victims: view.victims,
        citizenId: fireSelected,
        moves: fireMoves
      });
    }
    if (view.phase === 'city' && citySelected !== null) {
      return moveTargets({
        positions: view.positions,
        victims: view.victims,
        citizenId: citySelected,
        moves: cityMoves
      });
    }
    if (view.phase === 'day' && car && view.turn.movesLeft > 0 && mode === 'idle') {
      return getNeighbors(car.x, car.y);
    }
    return [];
  }, [view, mode, car, relocSelected, relocAssignments, fireSelected, fireMoves, citySelected, cityMoves]);

  const selectableCitizenIds = useMemo((): number[] => {
    if (view.phase === 'relocation') {
      // уже назначенного тоже можно выбрать заново и переназначить
      return strandedCitizens.map(p => p.citizenId);
    }
    if (view.phase === 'city') {
      if (!isCityMyTurn || view.city?.emptyGroupNotice) return [];
      const group = view.city!.group;
      return alive.filter(p => citizenById(p.citizenId).group === group).map(p => p.citizenId);
    }
    if (view.phase !== 'day' || !car) return [];
    const neighbors = getNeighbors(car.x, car.y);
    const nearby = (p: { districtX: number; districtY: number }) =>
      (p.districtX === car.x && p.districtY === car.y) ||
      neighbors.some(n => n.x === p.districtX && n.y === p.districtY);

    switch (mode) {
      case 'police':
        return alive.filter(p => nearby(p) && !view.policeTokens.some(t => t.citizenId === p.citizenId)).map(p => p.citizenId);
      case 'hospital':
        return alive.filter(p => nearby(p) && p.isScared).map(p => p.citizenId);
      case 'diner':
        return alive
          .filter(p => !p.isScared && neighbors.some(n => n.x === p.districtX && n.y === p.districtY))
          .map(p => p.citizenId);
      case 'fire': {
        if (!fireGroup) return [];
        return alive.filter(p => citizenById(p.citizenId).group === fireGroup).map(p => p.citizenId);
      }
      default:
        return [];
    }
  }, [view, mode, car, alive, strandedCitizens, relocAssignments, fireGroup, isCityMyTurn]);

  // ==== обработчики листа ====
  const handleDistrictClick = async (x: number, y: number) => {
    if (view.phase === 'setup') {
      await sendCommand({ type: 'detective:placeCar', x, y });
      return;
    }
    // пока житель выбран, клик по неподсвеченному району ничего не назначает
    const allowed = availableDistricts.some(d => d.x === x && d.y === y);
    if (view.phase === 'relocation' && relocSelected !== null) {
      if (!allowed) return;
      setRelocAssignments(prev => ({ ...prev, [relocSelected]: { x, y } }));
      setRelocSelected(null);
      return;
    }
    if (view.phase === 'day' && mode === 'fire' && fireSelected !== null) {
      if (!allowed) return;
      setFireMoves(prev => ({ ...prev, [fireSelected]: { x, y } }));
      setFireSelected(null);
      return;
    }
    if (view.phase === 'city' && citySelected !== null) {
      if (!allowed) return;
      setCityMoves(prev => ({ ...prev, [citySelected]: { x, y } }));
      setCitySelected(null);
      return;
    }
    setSelected({ x, y });
  };

  const handleCitizenClick = async (citizenId: number) => {
    // повторный клик по выбранному жителю — отмена его переезда
    if (view.phase === 'relocation') {
      if (relocSelected === citizenId) {
        setRelocSelected(null);
        setRelocAssignments(prev => withoutMove(prev, citizenId));
      } else {
        setRelocSelected(citizenId);
      }
      return;
    }
    if (view.phase === 'city') {
      if (citySelected === citizenId) {
        setCitySelected(null);
        setCityMoves(prev => withoutMove(prev, citizenId));
      } else {
        setCitySelected(citizenId);
      }
      return;
    }
    if (!currentBuilding) return;
    switch (mode) {
      case 'diner':
        setQuestionTarget({ citizenId, viaDiner: true });
        break;
      case 'police': {
        const ok = await sendCommand({
          type: 'detective:useBuilding',
          buildingId: currentBuilding.id,
          payload: { kind: 'police', citizenId }
        });
        if (ok) resetModes();
        break;
      }
      case 'hospital': {
        const ok = await sendCommand({
          type: 'detective:useBuilding',
          buildingId: currentBuilding.id,
          payload: { kind: 'hospital', citizenId }
        });
        if (ok) resetModes();
        break;
      }
      case 'fire':
        if (fireSelected === citizenId) {
          setFireSelected(null);
          setFireMoves(prev => withoutMove(prev, citizenId));
        } else {
          setFireSelected(citizenId);
        }
        break;
    }
  };

  const submitQuestion = async (attribute: QuestionAttribute, value: QuestionValue) => {
    if (!questionTarget) return;
    const ok =
      questionTarget.viaDiner && currentBuilding
        ? await sendCommand({
            type: 'detective:useBuilding',
            buildingId: currentBuilding.id,
            payload: { kind: 'diner', citizenId: questionTarget.citizenId, attribute, value }
          })
        : await sendCommand({
            type: 'detective:question',
            citizenId: questionTarget.citizenId,
            attribute,
            value
          });
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

  // сколько жителей ещё под подозрением: по ответам, которым верим, и своему фильтру
  const suspectCount = deduction.suspectIds.size;

  // ==== содержимое папки дела ====
  const selectedCitizens = inDistrict(selected);
  const canAct = view.phase === 'day' && !view.pendingQuestion;
  const carHere = !!selected && !!car && car.x === selected.x && car.y === selected.y;

  const folderCitizens: CitizenState[] = selectedCitizens.map(p => {
    const citizen = citizenById(p.citizenId);
    const token = view.policeTokens.find(t => t.citizenId === p.citizenId);
    if (p.isScared) {
      return { citizen, position: p, state: 'ЗАПУГАН', tone: 'danger' };
    }
    if (view.turn.questionedCitizenIds.includes(p.citizenId)) {
      return { citizen, position: p, state: 'УЖЕ СПРОСИЛИ', tone: 'quiet' };
    }
    if (carHere && canAct && view.turn.abilitiesLeft > 0) {
      return { citizen, position: p, state: 'МОЖНО СПРОСИТЬ', tone: 'ok' };
    }
    return {
      citizen,
      position: p,
      state: token ? 'ПОД СЛЕЖКОЙ' : 'В РАЙОНЕ',
      tone: 'quiet'
    };
  });

  const badges: Array<{ label: string; tone: 'plain' | 'police' | 'blood' }> = [];
  if (view.phase === 'city' && view.city) {
    badges.push({
      label: `${view.city.stage === 'detective' ? 'ВАШ ЖЕТОН' : 'ЖЕТОН УБИЙЦЫ'}: ${GROUP_LABELS[
        view.city.group
      ].toUpperCase()}`,
      tone: view.city.stage === 'detective' ? 'police' : 'blood'
    });
  }
  if (selected) {
    badges.push({
      label: `ЖИТЕЛЕЙ ${selectedCitizens.length}/${MAX_CITIZENS_PER_DISTRICT}`,
      tone: 'plain'
    });
    if (carHere) badges.push({ label: 'МАШИНА ЗДЕСЬ', tone: 'police' });
    else if (car && getNeighbors(car.x, car.y).some(n => n.x === selected.x && n.y === selected.y)) {
      badges.push({ label: 'СМЕЖНЫЙ С МАШИНОЙ', tone: 'police' });
    }
    if (view.victims.some(v => v.districtX === selected.x && v.districtY === selected.y)) {
      badges.push({ label: 'МЕСТО ПРЕСТУПЛЕНИЯ', tone: 'blood' });
    }
  }

  const actions = useMemo((): ActionSpec[] => {
    const list: ActionSpec[] = [];

    if (view.phase === 'setup') {
      list.push({
        id: 'setup',
        title: 'Поставьте полицейскую машину',
        desc: 'Кликните по любому району на карте',
        icon: 'move',
        tone: 'primary'
      });
      return list;
    }

    if (view.phase === 'night') {
      list.push({
        id: 'wait-night',
        title: 'Ночь. Убийца делает ход',
        desc: 'Дождитесь утренней сводки',
        icon: 'lock',
        tone: 'disabled'
      });
      return list;
    }

    if (view.phase === 'relocation') {
      const left = strandedCitizens.filter(p => !relocAssignments[p.citizenId]).length;
      list.push({
        id: 'reloc',
        title: 'Расселите жителей с места преступления',
        desc: left > 0 ? `Осталось расселить: ${left}` : 'Все расселены — подтвердите',
        icon: 'move',
        tone: left > 0 ? 'primary' : 'plain',
        onClick: left > 0 ? undefined : submitRelocation
      });
      return list;
    }

    if (view.phase === 'city') {
      if (!isCityMyTurn) {
        list.push({
          id: 'city-wait',
          title: 'Фаза Города: ходит убийца',
          desc: view.city
            ? `Убийца тянул жетон «${GROUP_LABELS[view.city.group]}» и двигает эту группу`
            : '',
          icon: 'lock',
          tone: 'disabled'
        });
      } else if (view.city?.emptyGroupNotice) {
        list.push({
          id: 'city-empty',
          title: `В группе «${GROUP_LABELS[view.city.emptyGroupNotice]}» никого не осталось`,
          desc: 'Выберите другую группу — жетон уйдёт из игры',
          icon: 'token',
          tone: 'primary'
        });
      } else {
        list.push({
          id: 'city-move',
          title: `Ваш жетон: «${view.city ? GROUP_LABELS[view.city.group] : ''}»`,
          desc: 'Кликните жителя группы, затем подсвеченный район. Повторный клик по жителю — отмена',
          icon: 'move',
          tone: 'plain'
        });
      }
      return list;
    }

    // после пятого убийства: партия ещё идёт, жетоны слежки срабатывают до приговора
    if (view.phase === 'accusation') {
      list.push({
        id: 'accuse',
        title: 'Предъявить обвинение',
        desc:
          accuseCountdown !== null && accuseCountdown > 0
            ? `Окно обвинения откроется само через ${accuseCountdown} с`
            : 'Назовите профессию убийцы и его мотив',
        icon: 'ask',
        tone: 'primary',
        onClick: openAccusation
      });
      view.policeTokens.forEach(t => {
        if (posOf(t.citizenId)?.isDead) return;
        list.push({
          id: `token-${t.citizenId}`,
          title: `Спросить по жетону: ${citizenById(t.citizenId).job}`,
          desc: 'Честный ответ: мог ли убийца убить его сейчас. Жетон сгорает',
          icon: 'token',
          tone: view.pendingQuestion ? 'disabled' : 'police',
          onClick: () => sendCommand({ type: 'detective:policeQuestion', citizenId: t.citizenId })
        });
      });
      return list;
    }

    if (view.phase !== 'day') return list;

    if (!selected) {
      list.push({
        id: 'pick',
        title: 'Выберите район на карте',
        desc: 'Панель покажет, что там можно сделать',
        icon: 'eye',
        tone: 'disabled'
      });
      return list;
    }

    // перемещение
    const adjacent = car && getNeighbors(car.x, car.y).some(n => n.x === selected.x && n.y === selected.y);
    if (!carHere) {
      list.push({
        id: 'move',
        title: 'Переехать в этот район',
        desc:
          !adjacent
            ? 'Район не смежен с машиной'
            : view.turn.movesLeft <= 0
              ? 'Перемещения на этот ход закончились'
              : `Останется перемещений: ${view.turn.movesLeft - 1}`,
        icon: 'move',
        tone: adjacent && view.turn.movesLeft > 0 && canAct ? 'primary' : 'disabled',
        onClick: () => sendCommand({ type: 'detective:move', x: selected.x, y: selected.y })
      });
    }

    // допрос жителей района
    const askable = selectedCitizens.filter(p => !p.isScared);
    const wrongDistrict =
      view.turn.questionedDistrict &&
      (view.turn.questionedDistrict.x !== selected.x || view.turn.questionedDistrict.y !== selected.y);
    askable.forEach(p => {
      const citizen = citizenById(p.citizenId);
      const alreadyAsked = view.turn.questionedCitizenIds.includes(p.citizenId);
      const available =
        carHere && canAct && view.turn.abilitiesLeft > 0 && !wrongDistrict && !alreadyAsked;
      list.push({
        id: `ask-${p.citizenId}`,
        title: `Спросить: ${citizen.job}`,
        desc: !carHere
          ? 'Машина не в этом районе'
          : alreadyAsked
            ? 'Уже допрошен в этот ход — только через закусочную'
            : wrongDistrict
              ? 'В этот ход уже допрашивали другой район'
              : view.turn.abilitiesLeft <= 0
                ? 'Возможности на этот ход закончились'
                : 'Возможность · 4 признака на выбор',
        icon: 'ask',
        tone: available ? 'plain' : 'disabled',
        onClick: () => setQuestionTarget({ citizenId: p.citizenId, viaDiner: false })
      });
    });

    // слежка по жетону — бесплатно
    selectedCitizens.forEach(p => {
      const token = view.policeTokens.find(t => t.citizenId === p.citizenId);
      if (!token) return;

      list.push({
        id: `token-${p.citizenId}`,
        title: `Спросить по жетону: ${citizenById(p.citizenId).job}`,
        desc: 'Честный ответ. Бесплатно, жетон сгорает',
        icon: 'token',
        tone: canAct ? 'police' : 'disabled',
        onClick: () => sendCommand({ type: 'detective:policeQuestion', citizenId: p.citizenId })
      });
    });

    // эффект здания
    const building = view.buildings.find(b => b.districtX === selected.x && b.districtY === selected.y);
    if (building) {
      const used = view.turn.usedBuildingIds.includes(building.id);
      const usable = carHere && canAct && !used && view.turn.abilitiesLeft > 0;
      const titles: Record<string, string> = {
        police: 'Полицейский участок: положить жетон',
        hospital: 'Больница: снять испуг с жителя',
        diner: 'Закусочная: спросить в соседнем районе',
        fire: 'Пожарная часть: подвинуть группу'
      };
      list.push({
        id: `building-${building.id}`,
        title: titles[building.type],
        desc: !carHere
          ? 'Машина не в этом районе'
          : used
            ? 'Здание уже использовано в этот ход'
            : view.turn.abilitiesLeft <= 0
              ? 'Возможности на этот ход закончились'
              : 'Возможность · эффект здания',
        icon: building.type,
        tone: usable ? 'plain' : 'disabled',
        onClick: () => setMode(building.type as TargetMode)
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'nothing',
        title: 'В этом районе нечего делать',
        desc: 'Выберите другой район или закончите ход',
        icon: 'lock',
        tone: 'disabled'
      });
    }

    // горячие клавиши раздаём по порядку только доступным действиям
    let key = 1;
    for (const a of list) {
      if (a.tone !== 'disabled' && a.onClick && key <= 9) a.hotkey = String(key++);
    }
    return list;
  }, [
    view,
    selected,
    selectedCitizens,
    carHere,
    canAct,
    strandedCitizens,
    relocAssignments,
    isCityMyTurn,
    accuseCountdown
  ]);

  // горячие клавиши: цифра запускает действие из списка, Esc снимает выбор цели
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // справка доступна всегда, даже поверх допроса и обвинения
      if (e.key === 'F1') {
        e.preventDefault();
        setRulesOpen(v => !v);
        return;
      }
      if (rulesOpen) return;
      if (questionTarget || accuseOpen || view.phase === 'accusation') return;
      if (e.key === 'Escape') {
        resetModes();
        return;
      }
      const action = actions.find(a => a.hotkey === e.key && a.tone !== 'disabled' && a.onClick);
      if (action) {
        e.preventDefault();
        action.onClick!();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, questionTarget, accuseOpen, view.phase, rulesOpen]);

  // подсказка режима выбора цели
  const modeHint =
    mode === 'police'
      ? 'Кликните жителя в этом или соседнем районе — на него ляжет жетон слежки.'
      : mode === 'hospital'
        ? 'Кликните запуганного жителя в этом или соседнем районе.'
        : mode === 'diner'
          ? 'Кликните незапуганного жителя в соседнем районе.'
          : mode === 'fire'
            ? 'Выберите группу, затем жителя и соседний район.'
            : null;

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
      {/* лампа над картой */}
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
          role="detective"
          phase={view.phase}
          turnNumber={view.turnNumber}
          myName={myName}
          opponentName={opponentName}
          opponentConnected={opponentConnected}
          movesLeft={view.phase === 'day' ? view.turn.movesLeft : null}
          abilitiesLeft={view.phase === 'day' ? view.turn.abilitiesLeft : null}
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
            selectedDistrict={selected}
            onDistrictClick={handleDistrictClick}
            revealTraits={traits.reveal}
            selectableCitizenIds={selectableCitizenIds}
            pendingCitizenIds={[
              ...Object.keys(relocAssignments).map(Number),
              ...Object.keys(fireMoves).map(Number),
              ...Object.keys(cityMoves).map(Number),
              ...[relocSelected, fireSelected, citySelected].filter((v): v is number => v !== null)
            ]}
            onCitizenClick={handleCitizenClick}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          {view.phase === 'accusation' && !forcedAccuseOpen && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '11px 14px',
                borderRadius: 5,
                border: '1px solid oklch(0.5 0.14 27)',
                background: 'oklch(0.26 0.06 27 / .75)'
              }}
            >
              <span
                style={{
                  width: 42,
                  flexShrink: 0,
                  textAlign: 'center',
                  fontFamily: FONT.display,
                  fontSize: 36,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: 'oklch(0.9 0.1 30)'
                }}
              >
                {accuseCountdown !== null && accuseCountdown > 0 ? accuseCountdown : '5'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: '0.22em',
                    color: 'oklch(0.82 0.1 30)'
                  }}
                >
                  ПЯТОЕ УБИЙСТВО · ДЕЛО ЗАКРЫВАЕТСЯ
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'oklch(0.86 0.04 40)', marginTop: 3 }}>
                  {accuseCountdown !== null && accuseCountdown > 0
                    ? `Окно обвинения откроется через ${accuseCountdown} с. Осмотрите карту и журнал — жетоны слежки ещё работают.`
                    : 'Осмотрите карту и журнал, затем предъявите обвинение.'}
                </div>
              </div>
            </div>
          )}

          <CaseTabs
            tabs={[
              { id: 'place', label: 'МЕСТО' },
              { id: 'journal', label: `ЖУРНАЛ · ${suspectCount}` },
              {
                id: 'motives',
                label: `МОТИВЫ · ${view.motiveOptions.length - crossedMotives.length}`
              }
            ]}
            active={tab}
            onSelect={id => setTab(id as 'place' | 'journal' | 'motives')}
          />

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginTop: -12
            }}
          >
            {tab === 'journal' ? (
              <div
                style={{
                  background: 'oklch(0.225 0.013 55)',
                  border: '1px solid oklch(0.3 0.015 55)',
                  borderRadius: '0 0 5px 5px',
                  padding: '14px 15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  boxShadow: '0 1px 0 oklch(0.4 0.02 55 / .22) inset, 0 10px 24px -12px rgba(0,0,0,.7)'
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: '0.24em',
                      color: P.gold,
                      marginBottom: 9
                    }}
                  >
                    ЖУРНАЛ ДОПРОСОВ
                  </div>
                  <Journal {...journalProps} />
                </div>
                <SuspectsSheet
                  citizens={view.citizens}
                  positions={view.positions}
                  deduction={deduction}
                  filter={suspectFilter}
                  onFilterChange={setSuspectFilter}
                />
              </div>
            ) : tab === 'motives' ? (
              <div
                style={{
                  background: 'oklch(0.225 0.013 55)',
                  border: '1px solid oklch(0.3 0.015 55)',
                  borderRadius: '0 0 5px 5px',
                  padding: '14px 15px',
                  boxShadow: '0 1px 0 oklch(0.4 0.02 55 / .22) inset, 0 10px 24px -12px rgba(0,0,0,.7)'
                }}
              >
                <MotivesPanel
                  motiveOptions={view.motiveOptions}
                  crossed={crossedMotives}
                  onToggle={id =>
                    setCrossedMotives(prev =>
                      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                    )
                  }
                />
              </div>
            ) : (
            <CaseFolder
              district={selected}
              badges={badges}
              citizens={folderCitizens}
              actionsTitle="ЧТО МОЖНО СДЕЛАТЬ СЕЙЧАС"
              actions={actions}
            >
              {/* выбор группы для пожарных */}
              {mode === 'fire' && !fireGroup && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(Object.keys(GROUP_LABELS) as CitizenGroup[]).map(g => (
                    <button
                      key={g}
                      onClick={() => setFireGroup(g)}
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
              {mode === 'fire' && fireGroup && (
                <div style={{ marginTop: 10, display: 'flex', gap: 7 }}>
                  <PrimaryButton label="Применить" onClick={submitFire} />
                  <DangerButton label="Отмена" onClick={resetModes} width={120} />
                </div>
              )}

              {/* фаза Города: замена пустого жетона. Без этих кнопок ход детектива
                  заходил в тупик — двигать некого, а сменить группу нечем */}
              {isCityMyTurn && view.city?.emptyGroupNotice && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(Object.keys(GROUP_LABELS) as CitizenGroup[])
                    .filter(
                      g =>
                        g !== view.city!.emptyGroupNotice &&
                        view.citizens.some(c => c.group === g && !posOf(c.id)?.isDead)
                    )
                    .map(g => (
                      <button
                        key={g}
                        onClick={() => void sendCommand({ type: 'city:chooseGroup', group: g })}
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
            </CaseFolder>
            )}

            {/* расселение: список и подтверждение */}
            {tab === 'place' && view.phase === 'relocation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <HintBox>
                  Кликните жителя, затем подсвеченный район. Расселённого можно выбрать снова и
                  переназначить; повторный клик по выбранному жителю отменяет назначение.
                </HintBox>
                {strandedCitizens.map(p => {
                  const assigned = relocAssignments[p.citizenId];
                  return (
                    <div
                      key={p.citizenId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 4,
                        border: '1px solid oklch(0.3 0.015 55)',
                        background: 'oklch(0.225 0.013 55)'
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{citizenById(p.citizenId).job}</span>
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          letterSpacing: '0.12em',
                          color: assigned ? P.gold : 'oklch(0.6 0.014 80)'
                        }}
                      >
                        {assigned
                          ? `→ ${districtTitle(assigned.x, assigned.y)} · ${districtName(assigned.x, assigned.y)}`
                          : 'НЕ РАССЕЛЁН'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {modeHint && <HintBox>{modeHint}</HintBox>}

            {view.phase === 'day' && !modeHint && (
              <HintBox>
                Ответ жителя может быть ложью: убийца и его группа-помощник вправе соврать. Жетон
                полиции — единственный честный ответ.
              </HintBox>
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

          {/* главные кнопки хода */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 9 }}>
            {view.phase === 'relocation' ? (
              <>
                <PrimaryButton
                  label="Подтвердить расселение"
                  onClick={submitRelocation}
                  disabled={strandedCitizens.some(p => !relocAssignments[p.citizenId])}
                />
                <DangerButton
                  label="Сбросить"
                  width={120}
                  disabled={Object.keys(relocAssignments).length === 0}
                  onClick={() => {
                    setRelocAssignments({});
                    setRelocSelected(null);
                  }}
                />
              </>
            ) : view.phase === 'city' ? (
              <>
                <PrimaryButton
                  label="Готово"
                  onClick={submitCityMove}
                  disabled={!isCityMyTurn || !!view.city?.emptyGroupNotice}
                />
                {isCityMyTurn && (
                  <DangerButton
                    label="Сбросить"
                    width={120}
                    disabled={Object.keys(cityMoves).length === 0}
                    onClick={() => {
                      setCityMoves({});
                      setCitySelected(null);
                    }}
                  />
                )}
              </>
            ) : view.phase === 'accusation' ? (
              <PrimaryButton label="Предъявить обвинение" onClick={openAccusation} />
            ) : (
              <>
                <PrimaryButton
                  label="Закончить ход"
                  onClick={() => sendCommand({ type: 'detective:endTurn' })}
                  disabled={!canAct}
                />
                <DangerButton label="Обвинить" onClick={() => setAccuseOpen(true)} disabled={!canAct} />
              </>
            )}
          </div>
        </div>
      </div>

      <QuestionDialog
        citizen={questionTarget ? citizenById(questionTarget.citizenId) : null}
        viaDiner={questionTarget?.viaDiner ?? false}
        onSubmit={submitQuestion}
        onClose={() => setQuestionTarget(null)}
      />

      <AccuseDialog
        open={accuseOpen || forcedAccuseOpen}
        forced={view.phase === 'accusation'}
        citizens={view.citizens.filter(c => {
          const pos = posOf(c.id);
          return pos && !pos.isDead;
        })}
        positions={view.positions}
        policeTokens={view.policeTokens}
        policeAnswers={view.policeAnswers}
        suspectIds={deduction.suspectIds}
        onPoliceQuestion={citizenId => void sendCommand({ type: 'detective:policeQuestion', citizenId })}
        allCitizens={view.citizens}
        victims={view.victims}
        motiveOptions={view.motiveOptions}
        crossedMotives={crossedMotives}
        journal={<Journal {...journalProps} />}
        onSubmit={(job, motiveId) => {
          void sendCommand({ type: 'detective:accuse', job, motiveId });
          setAccuseOpen(false);
        }}
        onClose={() => {
          // после пятого убийства это «к карте»: обвинение остаётся обязательным
          if (view.phase === 'accusation') setAccuseHidden(true);
          setAccuseOpen(false);
        }}
      />
    </div>
  );
}
