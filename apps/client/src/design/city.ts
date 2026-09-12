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

/** Цвета жителей из движка → палитра жетонов макета */
const COLOR_TO_CHIT: Record<string, ChitColor> = {
  purple: 'purple',
  blue: 'blue',
  lightBlue: 'sky',
  pink: 'pink',
  red: 'red',
  yellow: 'amber',
  green: 'green',
  orange: 'orange',
  brown: 'brown',
  gray: 'gray',
  black: 'slate',
  white: 'bone'
};

export function chitRing(color: string): string {
  return CHIT[COLOR_TO_CHIT[color] ?? 'gray'];
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
