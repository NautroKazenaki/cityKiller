import type {
  AnsweredQuestion,
  Citizen,
  CitizenGroup,
  CitizenPosition,
  QuestionAttribute,
  QuestionValue
} from '@citykiller/shared';
import { ATTRIBUTE_VALUES } from './labels';

export const ATTRS: QuestionAttribute[] = ['sex', 'age', 'size', 'height'];

/**
 * Свой фильтр детектива: какие значения признаков и какие группы подсвечивать.
 * Пустой список — «любое значение». Это личные пометки, движок о них не знает.
 */
export type SuspectFilter = Record<QuestionAttribute, QuestionValue[]> & { group: CitizenGroup[] };

export type FilterKey = QuestionAttribute | 'group';

export const EMPTY_FILTER: SuspectFilter = { sex: [], age: [], size: [], height: [], group: [] };

export function isFilterEmpty(filter: SuspectFilter): boolean {
  return ATTRS.every(a => filter[a].length === 0) && filter.group.length === 0;
}

export function toggleFilterValue(
  filter: SuspectFilter,
  key: FilterKey,
  value: QuestionValue | CitizenGroup
): SuspectFilter {
  const list = filter[key] as Array<QuestionValue | CitizenGroup>;
  const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  return { ...filter, [key]: next };
}

export function matchesFilter(citizen: Citizen, filter: SuspectFilter): boolean {
  if (filter.group.length > 0 && !filter.group.includes(citizen.group)) return false;
  return ATTRS.every(a => filter[a].length === 0 || filter[a].includes(citizen[a]));
}

export type CellStatus = 'good' | 'bad' | undefined;

/**
 * Статус ячейки относительно учтённых ответов:
 * good — признак подтверждён ответом «да», bad — противоречит какому-то ответу.
 */
export function cellStatusFor(
  citizen: Citizen,
  attribute: QuestionAttribute,
  answers: AnsweredQuestion[]
): CellStatus {
  let status: CellStatus;
  for (const a of answers) {
    if (a.attribute !== attribute) continue;
    const matches = citizen[attribute] === a.value;
    if (a.answer !== matches) return 'bad';
    if (a.answer && matches) status = 'good';
  }
  return status;
}

export function excludedByAnswers(citizen: Citizen, answers: AnsweredQuestion[]): boolean {
  return ATTRS.some(a => cellStatusFor(citizen, a, answers) === 'bad');
}

/**
 * Ответы, которые не могут быть правдой одновременно: по признаку не остаётся
 * ни одного возможного значения («убийце 40?» — да, и «убийце 40?» — нет).
 * Значит, кто-то из спрошенных солгал — это убийца или его помощник.
 */
export function conflictingAnswerIds(answers: AnsweredQuestion[]): Set<string> {
  const conflicts = new Set<string>();
  for (const attr of ATTRS) {
    const own = answers.filter(a => a.attribute === attr);
    let possible = ATTRIBUTE_VALUES[attr].map(v => v.value);
    for (const a of own) {
      possible = a.answer ? possible.filter(v => v === a.value) : possible.filter(v => v !== a.value);
    }
    if (possible.length === 0) own.forEach(a => conflicts.add(a.id));
  }
  return conflicts;
}

export interface Deduction {
  /** Ответы, которым детектив верит (не отключённые вручную) */
  activeAnswers: AnsweredQuestion[];
  /** Учтённые ответы, противоречащие друг другу */
  conflicts: Set<string>;
  /** Живые, не исключённые ответами и прошедшие свой фильтр */
  suspectIds: Set<number>;
}

export function deduce(
  citizens: Citizen[],
  positions: CitizenPosition[],
  answers: AnsweredQuestion[],
  ignoredAnswerIds: string[],
  filter: SuspectFilter
): Deduction {
  const activeAnswers = answers.filter(a => !ignoredAnswerIds.includes(a.id));
  const alive = (id: number) => {
    const pos = positions.find(p => p.citizenId === id);
    return !!pos && !pos.isDead;
  };
  const suspectIds = new Set(
    citizens
      .filter(c => alive(c.id) && !excludedByAnswers(c, activeAnswers) && matchesFilter(c, filter))
      .map(c => c.id)
  );
  return { activeAnswers, conflicts: conflictingAnswerIds(activeAnswers), suspectIds };
}
