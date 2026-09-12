/**
 * Токены дизайн-концепта «Дело на столе».
 * Значения перенесены из макета без изменений — не подбирать на глаз.
 */

/** Базовая палитра: стол (тёмный интерфейс) и бумага (светлая карта) */
export const P = {
  desk: 'oklch(0.19 0.012 55)',
  panel: 'oklch(0.225 0.013 55)',
  line: 'oklch(0.3 0.015 55)',
  ink: 'oklch(0.93 0.012 80)',
  dim: 'oklch(0.66 0.014 80)',
  gold: 'oklch(0.72 0.12 78)',
  police: 'oklch(0.62 0.12 250)',
  blood: 'oklch(0.58 0.16 27)',
  paper: 'oklch(0.93 0.02 85)',
  paperInk: 'oklch(0.28 0.02 60)'
} as const;

/** Цвета жетонов жителей: 12 оттенков на одной светлоте/хроме */
export const CHIT = {
  purple: 'oklch(0.55 0.15 300)',
  blue: 'oklch(0.55 0.15 258)',
  sky: 'oklch(0.6 0.12 225)',
  pink: 'oklch(0.58 0.16 350)',
  red: 'oklch(0.55 0.17 27)',
  amber: 'oklch(0.66 0.13 78)',
  green: 'oklch(0.57 0.13 150)',
  orange: 'oklch(0.62 0.15 55)',
  brown: 'oklch(0.48 0.08 60)',
  gray: 'oklch(0.55 0.01 60)',
  slate: 'oklch(0.4 0.02 250)',
  bone: 'oklch(0.72 0.02 85)'
} as const;

export type ChitColor = keyof typeof CHIT;

/** Иконки-глифы: сетка 24, штрих 2, квадратные концы. Эмодзи в продакшене запрещены. */
export const ICON = {
  police: 'M4 20V9l8-5 8 5v11M9 20v-5h6v5M12 9v2',
  hospital: 'M5 21V8l7-4 7 4v13M9 13h6M12 10v6',
  fire: 'M3 18h18M6 18v-6h4l2-4h4v10M8 12V9',
  diner: 'M6 3v8a3 3 0 006 0V3M9 11v10M15 3c2 0 3 2 3 5s-1 5-3 5v8',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  ask: 'M9 9a3 3 0 116 0c0 2-3 2.5-3 5M12 18h.01M4 4h16v12H8l-4 4z',
  token: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z M12 9a3 3 0 100 6 3 3 0 000-6',
  lock: 'M6 11V8a6 6 0 0112 0v3M4 11h16v10H4z'
} as const;

export type IconName = keyof typeof ICON;

/** Семейства шрифтов. Big Shoulders без кириллицы — её закрывает Oswald. */
export const FONT = {
  display: "'Big Shoulders Display', 'Oswald', sans-serif",
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace"
} as const;

/** Радиусы: бумага 2px, панели 5px, жетоны — круг. Никаких rounded-xl. */
export const RADIUS = {
  paper: '2px',
  panel: '5px',
  control: '4px',
  chip: '2px',
  round: '9999px'
} as const;

/** Две тени, больше нет: «край картона» и опорная. */
export const SHADOW = {
  panel: '0 1px 0 oklch(0.4 0.02 55 / .22) inset, 0 10px 24px -12px rgba(0,0,0,.7)',
  card: '0 2px 0 rgba(0,0,0,.28), 0 7px 13px -5px rgba(0,0,0,.5)',
  sheet:
    '0 2px 0 oklch(0.99 0.01 85 / .5) inset, 0 26px 50px -18px rgba(0,0,0,.85), 0 0 0 1px oklch(0.55 0.03 60 / .5)'
} as const;

/** Геометрия главного экрана из макета (1600×900). */
export const LAYOUT = {
  topBar: 56,
  gap: 18,
  pad: 14,
  leftCol: 340,
  sheet: 720,
  sheetHeight: 810,
  city: 690,
  rowStrip: 30,
  fifthRow: 120
} as const;
