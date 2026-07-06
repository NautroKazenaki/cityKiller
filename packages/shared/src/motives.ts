import { KILLS_TO_WIN, aliveCitizensIn, isCityCenter } from './board';
import { Citizen, CitizenPosition, GameState } from './types';

export interface MotiveContext {
  victim: Citizen;
  victimPosition: CitizenPosition;
  state: GameState;
}

export interface Motive {
  id: string;
  title: string;
  description: string;
  canKill: (ctx: MotiveContext) => boolean;
}

/** Описание мотива без предиката — безопасно отдавать на клиент */
export interface MotiveDescriptor {
  id: string;
  title: string;
  description: string;
}

/** Уже убитые как объекты Citizen (в порядке убийства) */
function victimCitizens(state: GameState): Citizen[] {
  return state.victims
    .map(v => state.citizens.find(c => c.id === v.citizenId))
    .filter((c): c is Citizen => c !== undefined);
}

function killsLeftAfterThis(state: GameState): number {
  // Сколько убийств останется после текущего (текущее ещё не записано в killsCount)
  return KILLS_TO_WIN - state.killsCount - 1;
}

/** Кварталы соседние по 8 направлениям (включая диагонали) */
function isAdjacent8(ax: number, ay: number, bx: number, by: number): boolean {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}

export const MOTIVES: Motive[] = [
  {
    id: 'robber',
    title: 'Грабитель',
    description: 'Нельзя убивать в квартале, соседнем с предыдущим местом преступления',
    canKill: ({ victimPosition, state }) => {
      const prev = state.lastCrimeDistrict;
      if (!prev) return true;
      return !isAdjacent8(
        victimPosition.districtX,
        victimPosition.districtY,
        prev.x,
        prev.y
      );
    }
  },
  {
    id: 'vigilante',
    title: 'Вигилант',
    description: 'Нельзя убивать в 8 кварталах вокруг фишки детектива',
    canKill: ({ victimPosition, state }) => {
      if (!state.detective) return true;
      return !isAdjacent8(
        victimPosition.districtX,
        victimPosition.districtY,
        state.detective.x,
        state.detective.y
      );
    }
  },
  {
    id: 'radical',
    title: 'Радикал',
    description: 'Минимум 3 жертвы должны принадлежать одной соц. группе',
    canKill: ({ victim, state }) => {
      // Проверяем, что после этого убийства цель «3 из одной группы» ещё достижима
      const victims = [...victimCitizens(state), victim];
      const remaining = killsLeftAfterThis(state);

      const groups = new Map<string, number>();
      for (const v of victims) {
        groups.set(v.group, (groups.get(v.group) ?? 0) + 1);
      }

      // Живые кандидаты по группам (без убийцы и уже убитых)
      const aliveByGroup = new Map<string, number>();
      for (const c of state.citizens) {
        if (c.id === state.killer.citizenId) continue;
        if (c.id === victim.id) continue;
        const pos = state.positions.find(p => p.citizenId === c.id);
        if (!pos || pos.isDead) continue;
        aliveByGroup.set(c.group, (aliveByGroup.get(c.group) ?? 0) + 1);
      }

      const allGroups = new Set([...groups.keys(), ...aliveByGroup.keys()]);
      for (const group of allGroups) {
        const have = groups.get(group) ?? 0;
        const canAdd = Math.min(remaining, aliveByGroup.get(group) ?? 0);
        if (have + canAdd >= 3) return true;
      }
      return false;
    }
  },
  {
    id: 'sadist',
    title: 'Садист',
    description: 'Нельзя убивать запуганных граждан',
    canKill: ({ victimPosition }) => !victimPosition.isScared
  },
  {
    id: 'terrorist',
    title: 'Террорист',
    description: 'Все жертвы должны принадлежать разным соц. группам',
    canKill: ({ victim, state }) =>
      !victimCitizens(state).some(v => v.group === victim.group)
  },
  {
    id: 'spy',
    title: 'Шпион',
    description: 'Все жертвы должны быть убиты в кварталах со зданиями',
    canKill: ({ victimPosition, state }) =>
      state.buildings.some(
        b =>
          b.districtX === victimPosition.districtX &&
          b.districtY === victimPosition.districtY
      )
  },
  {
    id: 'maniac',
    title: 'Маньяк',
    description: 'Все жертвы должны быть одного пола',
    canKill: ({ victim, state }) => {
      const victims = victimCitizens(state);
      if (victims.length === 0) return true;
      return victims[0].sex === victim.sex;
    }
  },
  {
    id: 'psychopath',
    title: 'Психопат',
    description: 'Все жертвы должны быть максимум двух разных возрастов',
    canKill: ({ victim, state }) => {
      const ages = new Set(victimCitizens(state).map(v => v.age));
      ages.add(victim.age);
      return ages.size <= 2;
    }
  },
  {
    id: 'cannibal',
    title: 'Каннибал',
    description: 'Среди жертв должны быть жители всех трёх видов телосложения',
    canKill: ({ victim, state }) => {
      // Недостающих телосложений должно оставаться не больше, чем будущих убийств
      const sizes = new Set(victimCitizens(state).map(v => v.size));
      sizes.add(victim.size);
      const missing = 3 - sizes.size;
      return missing <= killsLeftAfterThis(state);
    }
  },
  {
    id: 'hitman',
    title: 'Киллер',
    description: 'Можно убивать только в кварталах с одним жителем',
    canKill: ({ victimPosition, state }) =>
      aliveCitizensIn(state.positions, victimPosition.districtX, victimPosition.districtY)
        .length === 1
  },
  {
    id: 'thug',
    title: 'Головорез',
    description: 'Нельзя убивать в 4 центральных кварталах города',
    canKill: ({ victimPosition }) =>
      !isCityCenter(victimPosition.districtX, victimPosition.districtY)
  }
];

export const MOTIVE_DESCRIPTORS: MotiveDescriptor[] = MOTIVES.map(({ id, title, description }) => ({
  id,
  title,
  description
}));

export function getMotive(id: string): Motive | undefined {
  return MOTIVES.find(m => m.id === id);
}
