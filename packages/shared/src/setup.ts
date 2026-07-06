import rawCitizens from './data/citizens.json';
import { getGroupForJob } from './data/groups';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  isCorner
} from './board';
import { MOTIVES } from './motives';
import {
  ALL_GROUPS,
  Building,
  BuildingType,
  Citizen,
  CitizenPosition,
  GameState
} from './types';

export const CITIZENS_IN_GAME = 20;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getAllCitizens(): Citizen[] {
  return (rawCitizens.citizens as Array<Omit<Citizen, 'group'>>).map(c => ({
    ...c,
    group: getGroupForJob(c.job)
  }));
}

/** Выбирает 20 случайных жителей так, чтобы были представлены все 9 групп */
export function pickGameCitizens(): Citizen[] {
  const all = shuffle(getAllCitizens());
  const picked: Citizen[] = [];
  const seenGroups = new Set<string>();

  // Сначала по одному из каждой группы
  for (const citizen of all) {
    if (!seenGroups.has(citizen.group)) {
      seenGroups.add(citizen.group);
      picked.push(citizen);
    }
  }
  // Добираем до 20 кем угодно
  for (const citizen of all) {
    if (picked.length >= CITIZENS_IN_GAME) break;
    if (!picked.includes(citizen)) picked.push(citizen);
  }
  return picked.slice(0, CITIZENS_IN_GAME);
}

/**
 * Расстановка: в углах по 2 жителя, остальные по 1.
 * 20 жителей = 4 угла x 2 + 12 обычных районов — все 16 кварталов заняты.
 */
export function placeCitizens(citizens: Citizen[]): CitizenPosition[] {
  const positions: CitizenPosition[] = [];

  const corners: Array<{ x: number; y: number }> = [];
  const others: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      (isCorner(x, y) ? corners : others).push({ x, y });
    }
  }

  const slots: Array<{ x: number; y: number }> = [];
  for (const c of corners) {
    slots.push(c, c); // по 2 в каждый угол
  }
  const singles = shuffle(others).slice(0, CITIZENS_IN_GAME - slots.length);
  for (const s of singles) {
    slots.push(s);
  }

  const shuffledCitizens = shuffle(citizens);
  const perDistrictCount = new Map<string, number>();

  shuffledCitizens.forEach((citizen, index) => {
    const slot = slots[index];
    const key = `${slot.x},${slot.y}`;
    const count = perDistrictCount.get(key) ?? 0;
    perDistrictCount.set(key, count + 1);
    positions.push({
      citizenId: citizen.id,
      districtX: slot.x,
      districtY: slot.y,
      subPosition: (count + 1) as 1 | 2 | 3,
      isScared: false,
      isDead: false
    });
  });

  return positions;
}

/** По 2 здания каждого типа, не больше одного здания на район */
export function generateBuildings(): Building[] {
  const types: BuildingType[] = ['police', 'hospital', 'fire', 'diner'];
  const allDistricts: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      allDistricts.push({ x, y });
    }
  }

  const spots = shuffle(allDistricts).slice(0, types.length * 2);
  const buildings: Building[] = [];
  types.forEach((type, typeIndex) => {
    for (let i = 0; i < 2; i++) {
      const spot = spots[typeIndex * 2 + i];
      buildings.push({
        id: `building-${type}-${i + 1}`,
        type,
        districtX: spot.x,
        districtY: spot.y,
        subPosition: Math.floor(Math.random() * 3) + 1
      });
    }
  });
  return buildings;
}

/** Создание новой партии. Мотив подбирается так, чтобы у убийцы были валидные жертвы на старте. */
export function createGame(id: string): GameState {
  const citizens = pickGameCitizens();
  const positions = placeCitizens(citizens);
  const buildings = generateBuildings();

  const killerCitizen = citizens[Math.floor(Math.random() * citizens.length)];
  const allyGroup = ALL_GROUPS[Math.floor(Math.random() * ALL_GROUPS.length)];

  const state: GameState = {
    id,
    phase: 'setup',
    turnNumber: 1,
    citizens,
    positions,
    buildings,
    killer: { citizenId: killerCitizen.id, motiveId: '', allyGroup },
    motiveOptions: [],
    detective: null,
    killsCount: 0,
    victims: [],
    lastCrimeDistrict: null,
    policeTokens: [],
    turn: { movesLeft: 2, abilitiesLeft: 2, questionedDistrict: null, usedBuildingIds: [] },
    lastNight: null,
    pendingQuestion: null,
    answers: [],
    policeAnswers: [],
    winner: null,
    winReason: null,
    log: [
      {
        seq: 0,
        turnNumber: 1,
        role: 'system',
        message: 'Партия создана. Детектив выбирает район для полицейской машины.'
      }
    ]
  };

  // Мотив: перебираем в случайном порядке, берём первый с 3+ валидными жертвами
  const shuffledMotives = shuffle(MOTIVES);
  const chosen =
    shuffledMotives.find(motive => {
      const targets = citizens.filter(victim => {
        if (victim.id === killerCitizen.id) return false;
        const pos = positions.find(p => p.citizenId === victim.id)!;
        return motive.canKill({ victim, victimPosition: pos, state });
      });
      return targets.length >= 3;
    }) ?? shuffledMotives[0];

  state.killer.motiveId = chosen.id;

  // 6 мотивов-кандидатов для детектива: настоящий + 5 ложных, вперемешку
  const MOTIVE_OPTIONS_COUNT = 6;
  const decoys = shuffle(MOTIVES.filter(m => m.id !== chosen.id)).slice(
    0,
    MOTIVE_OPTIONS_COUNT - 1
  );
  state.motiveOptions = shuffle([chosen, ...decoys]).map(m => m.id);

  return state;
}
