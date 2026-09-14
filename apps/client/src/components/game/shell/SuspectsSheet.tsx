import type {
  Citizen,
  CitizenGroup,
  CitizenPosition,
  QuestionAttribute,
  QuestionValue
} from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';
import { GROUP_CHIT, groupRing } from '@/design/city';
import { HEIGHT_SHORT } from '@/lib/labels';
import {
  ATTRS,
  cellStatusFor,
  excludedByAnswers,
  isFilterEmpty,
  toggleFilterValue,
  type Deduction,
  type FilterKey,
  type SuspectFilter
} from '@/lib/deduction';

interface SuspectsSheetProps {
  citizens: Citizen[];
  positions: CitizenPosition[];
  deduction: Deduction;
  filter: SuspectFilter;
  onFilterChange: (filter: SuspectFilter) => void;
}

const CELL_LOOK = {
  good: { bg: 'oklch(0.4 0.09 150 / .35)', fg: 'oklch(0.88 0.1 150)' },
  bad: { bg: 'oklch(0.45 0.13 27 / .28)', fg: 'oklch(0.8 0.1 30)' }
} as const;

const ATTR_HEAD: Record<QuestionAttribute, string> = {
  sex: 'ПОЛ',
  age: 'ВОЗР.',
  size: 'ТЕЛО',
  height: 'РОСТ'
};

const FILTER_VALUES: Record<QuestionAttribute, Array<{ value: QuestionValue; label: string }>> = {
  sex: [
    { value: 'male', label: 'М' },
    { value: 'female', label: 'Ж' }
  ],
  age: [
    { value: 20, label: '20' },
    { value: 40, label: '40' },
    { value: 60, label: '60' }
  ],
  size: [
    { value: 'S', label: 'S' },
    { value: 'M', label: 'M' },
    { value: 'L', label: 'L' }
  ],
  height: [
    { value: 'small', label: HEIGHT_SHORT.small },
    { value: 'medium', label: HEIGHT_SHORT.medium },
    { value: 'large', label: HEIGHT_SHORT.large }
  ]
};

function cellValue(c: Citizen, a: QuestionAttribute): string {
  if (a === 'sex') return c.sex === 'male' ? 'М' : 'Ж';
  if (a === 'age') return String(c.age);
  if (a === 'size') return c.size;
  return HEIGHT_SHORT[c.height];
}

/**
 * Допросный лист: таблица дедукции. Два слоя: автоматический — по ответам,
 * которым детектив верит, и свой фильтр — подсветка по заданным признакам.
 * Свой фильтр нужен, когда ответы противоречат друг другу: авто-вывод тогда
 * честно показывает ноль подозреваемых, и без ручного инструмента делать нечего.
 */
export function SuspectsSheet({
  citizens,
  positions,
  deduction,
  filter,
  onFilterChange
}: SuspectsSheetProps) {
  const { activeAnswers, conflicts, suspectIds } = deduction;
  const asked = new Set(activeAnswers.map(a => a.attribute));
  const filtering = !isFilterEmpty(filter);
  const presentGroups = [...new Set(citizens.map(c => c.group))];
  const alive = (c: Citizen) => {
    const pos = positions.find(p => p.citizenId === c.id);
    return !!pos && !pos.isDead;
  };

  const head = (label: string, attr?: QuestionAttribute) => (
    <th
      key={label}
      style={{
        textAlign: 'left',
        padding: '0 6px 6px 0',
        fontFamily: FONT.mono,
        fontSize: 9.5,
        letterSpacing: '0.14em',
        fontWeight: 400,
        color: attr && (asked.has(attr) || filter[attr].length > 0) ? P.gold : 'oklch(0.58 0.014 80)',
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </th>
  );

  const chip = (key: FilterKey, value: QuestionValue | CitizenGroup, label: string, ring?: string) => {
    const on = (filter[key] as Array<QuestionValue | CitizenGroup>).includes(value);
    return (
      <button
        key={`${key}-${value}`}
        onClick={() => onFilterChange(toggleFilterValue(filter, key, value))}
        style={{
          height: 24,
          padding: '0 8px',
          borderRadius: 3,
          border: `1px solid ${on ? 'oklch(0.55 0.11 78)' : 'oklch(0.34 0.015 55)'}`,
          background: on ? 'oklch(0.34 0.06 78)' : 'oklch(0.25 0.013 55)',
          color: on ? 'oklch(0.94 0.06 85)' : 'oklch(0.74 0.014 80)',
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: '0.06em',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5
        }}
      >
        {ring && (
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: ring, flexShrink: 0 }} />
        )}
        {label}
      </button>
    );
  };

  const filterRow = (title: string, chips: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span
        style={{
          width: 52,
          flexShrink: 0,
          paddingTop: 6,
          fontFamily: FONT.mono,
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'oklch(0.58 0.014 80)'
        }}
      >
        {title}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{chips}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.24em', color: P.gold }}>
          ТАБЛИЦА ДЕДУКЦИИ
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            letterSpacing: '0.14em',
            padding: '3px 7px',
            borderRadius: 2,
            background: suspectIds.size === 0 ? 'oklch(0.3 0.06 27)' : 'oklch(0.28 0.015 55)',
            color: suspectIds.size === 0 ? 'oklch(0.85 0.1 30)' : 'oklch(0.72 0.014 80)'
          }}
        >
          ПОД ПОДОЗРЕНИЕМ {suspectIds.size}
        </span>
      </div>

      {conflicts.size > 0 && (
        <div
          style={{
            padding: '9px 11px',
            borderRadius: 4,
            border: '1px solid oklch(0.45 0.1 27)',
            background: 'oklch(0.26 0.05 27 / .45)',
            color: 'oklch(0.86 0.08 30)',
            fontSize: 12,
            lineHeight: 1.5
          }}
        >
          Ответы противоречат друг другу — значит, кто-то солгал: это убийца или его помощник.
          Нажмите «ВЕРЮ» у сомнительного ответа в журнале, чтобы таблица его не учитывала, или
          подсветите подозреваемых своим фильтром.
        </div>
      )}

      {/* свой фильтр */}
      <div
        style={{
          padding: '10px 11px',
          borderRadius: 4,
          border: '1px solid oklch(0.3 0.015 55)',
          background: 'oklch(0.21 0.012 55)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              letterSpacing: '0.2em',
              color: 'oklch(0.66 0.014 80)'
            }}
          >
            СВОЙ ФИЛЬТР · ПОДСВЕТКА
          </span>
          {filtering && (
            <button
              onClick={() => onFilterChange({ sex: [], age: [], size: [], height: [], group: [] })}
              style={{
                border: 'none',
                background: 'transparent',
                color: P.gold,
                fontFamily: FONT.mono,
                fontSize: 9.5,
                letterSpacing: '0.14em',
                cursor: 'pointer',
                padding: 0
              }}
            >
              СБРОСИТЬ
            </button>
          )}
        </div>
        {ATTRS.map(a =>
          filterRow(
            ATTR_HEAD[a],
            FILTER_VALUES[a].map(v => chip(a, v.value, v.label))
          )
        )}
        {filterRow(
          'ГРУППА',
          presentGroups.map(g => chip('group', g, GROUP_CHIT[g], groupRing(g)))
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(0.3 0.015 55)' }}>
            {head('ПРОФЕССИЯ')}
            {head('ГРУППА')}
            {ATTRS.map(a => head(ATTR_HEAD[a], a))}
          </tr>
        </thead>
        <tbody>
          {citizens.map(c => {
            const dead = !alive(c);
            const suspect = suspectIds.has(c.id);
            const excluded = !dead && excludedByAnswers(c, activeAnswers);
            const scared = positions.find(p => p.citizenId === c.id)?.isScared;
            return (
              <tr
                key={c.id}
                style={{
                  borderBottom: '1px solid oklch(0.26 0.014 55)',
                  opacity: dead ? 0.35 : suspect ? 1 : 0.45,
                  boxShadow: filtering && suspect ? `inset 3px 0 0 ${P.gold}` : 'none'
                }}
              >
                <td
                  style={{
                    padding: filtering && suspect ? '5px 6px 5px 8px' : '5px 6px 5px 0',
                    fontSize: 12,
                    fontWeight: 600,
                    color: P.ink,
                    textDecoration: dead || excluded ? 'line-through' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {c.job}
                  {scared && !dead && (
                    <span style={{ color: P.blood, marginLeft: 5, fontSize: 11 }}>испуган</span>
                  )}
                </td>
                <td
                  style={{
                    padding: '5px 6px 5px 0',
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    color: filter.group.includes(c.group) ? P.gold : 'oklch(0.62 0.014 80)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {GROUP_CHIT[c.group]}
                </td>
                {ATTRS.map(a => {
                  const status = asked.has(a) ? cellStatusFor(c, a, activeAnswers) : undefined;
                  const look = status ? CELL_LOOK[status] : null;
                  const filtered = filter[a].includes(c[a]);
                  return (
                    <td key={a} style={{ padding: '5px 6px 5px 0' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: 2,
                          fontFamily: FONT.mono,
                          fontSize: 11,
                          background: look?.bg ?? 'transparent',
                          color: look?.fg ?? (filtered ? P.gold : 'oklch(0.8 0.012 80)'),
                          outline: filtered ? `1px solid oklch(0.55 0.11 78 / .7)` : 'none',
                          fontWeight: status === 'good' || filtered ? 600 : 400
                        }}
                      >
                        {cellValue(c, a)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
