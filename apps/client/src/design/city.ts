import type { BuildingType, CitizenGroup } from '@citykiller/shared';
import { CHIT, ICON, type ChitColor, type IconName } from './tokens';

/** Названия районов 4×4 из макета. Координаты A1…D4 остаются вторичной подписью. */
export const DISTRICT_NAMES: string[][] = [
  ['ВЕРХНИЙ КАРЬЕР', 'ПРИЧАЛЫ', 'ЛАТИНСКИЙ КВАРТАЛ', 'СЕВЕРНАЯ КОСА'],
  ['ЗАПАДНЫЙ РЯД', 'БИРЖА', 'ПЛОЩАДЬ СЕНАТА', 'ВОСТОЧНЫЙ РЯД'],
  ['ФОНАРНЫЙ КВАРТАЛ', 'ГОРОДСКОЙ САД', 'СВЯТАЯ КЛАРА', 'РЕЧНОЙ ВОКЗАЛ'],
  ['АРЕНА', 'ЛИТЕЙНЫЙ', 'УНИВЕРСИТЕТ', 'СТАРЫЙ ГОРОД']
];

export function districtTitle(x: number, y: number): string {
  return DISTRICT_NAMES[y]?.[x] ?? `${String.fromCharCode(65 + x)}${y + 1}`;
}

/**
 * Цвет жетона — по ГРУППЕ, а не по личному цвету жителя.
 * Личный цвет ни о чём не говорил игроку; группа — то, чем он реально оперирует:
 * видно, из какой группы жертва, не читая подписей.
 */
const GROUP_TO_CHIT: Record<CitizenGroup, ChitColor> = {
  government: 'blue',
  criminal: 'red',
  medical: 'green',
  service: 'sky',
  entertainment: 'pink',
  education: 'purple',
  emergency: 'orange',
  business: 'brown',
  creative: 'amber'
};

export function groupRing(group: CitizenGroup): string {
  return CHIT[GROUP_TO_CHIT[group]];
}

/** Заливка ядра жетона: тот же цвет, разбавленный бумагой */
export function groupFill(group: CitizenGroup, strength = 20): string {
  return `color-mix(in oklch, ${groupRing(group)} ${strength}%, ${'oklch(0.93 0.02 85)'})`;
}

/** Подписи групп на жетоне: моно, верхний регистр, как на макете */
export const GROUP_CHIT: Record<CitizenGroup, string> = {
  government: 'ВЛАСТЬ',
  criminal: 'КРИМ.',
  medical: 'МЕД.',
  service: 'СЕРВИС',
  entertainment: 'РАЗВЛ.',
  education: 'ОБРАЗ.',
  emergency: 'ЭКСТР.',
  business: 'БИЗНЕС',
  creative: 'ТВОРЧ.'
};

/** Короткая подпись на латунной табличке здания */
export const BUILDING_SHORT: Record<BuildingType, string> = {
  police: 'УЧАСТОК',
  hospital: 'БОЛЬН.',
  fire: 'ПОЖАРН.',
  diner: 'ЗАКУС.'
};

export const BUILDING_ICON: Record<BuildingType, IconName> = {
  police: 'police',
  hospital: 'hospital',
  fire: 'fire',
  diner: 'diner'
};

export function buildingPath(type: BuildingType): string {
  return ICON[BUILDING_ICON[type]];
}

/** Инициал профессии для жетона */
export function monogram(job: string): string {
  return (job.trim()[0] ?? '?').toUpperCase();
}
