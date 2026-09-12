import type {
  AnsweredQuestion,
  Citizen,
  CitizenPosition,
  PoliceTokenAnswer,
  QuestionAttribute
} from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';
import { GROUP_CHIT } from '@/design/city';
import { HEIGHT_SHORT, questionText } from '@/lib/labels';

interface SuspectsSheetProps {
  citizens: Citizen[];
  positions: CitizenPosition[];
  answers: AnsweredQuestion[];
  policeAnswers: PoliceTokenAnswer[];
}

type CellStatus = 'good' | 'bad' | undefined;

const ATTRS: QuestionAttribute[] = ['sex', 'age', 'size', 'height'];

/**
 * Статус ячейки относительно собранных ответов:
 * good — признак подтверждён ответом «да», bad — противоречит ответу.
 */
function cellStatusFor(
  citizen: Citizen,
  attribute: QuestionAttribute,
  answers: AnsweredQuestion[]
): CellStatus {
  let status: CellStatus;
  for (const a of answers) {
    if (a.attribute !== attribute) continue;
    const matches = citizen[attribute] === a.value;
    const consistent = a.answer === matches;
    if (!consistent) return 'bad';
    if (a.answer && matches) status = 'good';
  }
  return status;
}

const CELL_LOOK = {
  good: { bg: 'oklch(0.4 0.09 150 / .35)', fg: 'oklch(0.88 0.1 150)' },
  bad: { bg: 'oklch(0.45 0.13 27 / .28)', fg: 'oklch(0.8 0.1 30)' }
} as const;

/** Допросный лист: таблица дедукции с автоматической подсветкой. Ядро работы детектива. */
export function SuspectsSheet({ citizens, positions, answers, policeAnswers }: SuspectsSheetProps) {
  const asked = new Set(answers.map(a => a.attribute));
  const isExcluded = (c: Citizen) => ATTRS.some(a => cellStatusFor(c, a, answers) === 'bad');
  const alive = (c: Citizen) => {
    const pos = positions.find(p => p.citizenId === c.id);
    return pos && !pos.isDead;
  };
  const suspects = citizens.filter(c => alive(c) && !isExcluded(c)).length;

  const value = (c: Citizen, a: QuestionAttribute): string => {
    if (a === 'sex') return c.sex === 'male' ? 'М' : 'Ж';
    if (a === 'age') return String(c.age);
    if (a === 'size') return c.size;
    return HEIGHT_SHORT[c.height];
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
        color: attr && asked.has(attr) ? P.gold : 'oklch(0.58 0.014 80)',
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: '0.24em',
            color: P.gold
          }}
        >
          ТАБЛИЦА ДЕДУКЦИИ
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            letterSpacing: '0.14em',
            padding: '3px 7px',
            borderRadius: 2,
            background: 'oklch(0.28 0.015 55)',
            color: 'oklch(0.72 0.014 80)'
          }}
        >
          ПОД ПОДОЗРЕНИЕМ {suspects}
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(0.3 0.015 55)' }}>
            {head('ПРОФЕССИЯ')}
            {head('ГРУППА')}
            {head('ПОЛ', 'sex')}
            {head('ВОЗР.', 'age')}
            {head('ТЕЛО', 'size')}
            {head('РОСТ', 'height')}
          </tr>
        </thead>
        <tbody>
          {citizens.map(c => {
            const dead = !alive(c);
            const excluded = !dead && isExcluded(c);
            const scared = positions.find(p => p.citizenId === c.id)?.isScared;
            return (
              <tr
                key={c.id}
                style={{
                  borderBottom: '1px solid oklch(0.26 0.014 55)',
                  opacity: dead ? 0.35 : excluded ? 0.5 : 1
                }}
              >
                <td
                  style={{
                    padding: '5px 6px 5px 0',
                    fontSize: 12,
                    fontWeight: 600,
                    color: P.ink,
                    textDecoration: dead ? 'line-through' : 'none',
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
                    color: 'oklch(0.62 0.014 80)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {GROUP_CHIT[c.group]}
                </td>
                {ATTRS.map(a => {
                  const status = asked.has(a) ? cellStatusFor(c, a, answers) : undefined;
                  const look = status ? CELL_LOOK[status] : null;
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
                          color: look?.fg ?? 'oklch(0.8 0.012 80)',
                          fontWeight: status === 'good' ? 600 : 400
                        }}
                      >
                        {value(c, a)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: '0.24em',
            color: P.gold,
            marginBottom: 8
          }}
        >
          ОТВЕТЫ ЖИТЕЛЕЙ · МОГУТ БЫТЬ ЛОЖЬЮ
        </div>
        {answers.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'oklch(0.55 0.014 80)' }}>
            Вопросов ещё не задавали.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...answers].reverse().map(a => {
              const citizen = citizens.find(c => c.id === a.citizenId);
              return (
                <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      padding: '3px 6px',
                      borderRadius: 2,
                      flexShrink: 0,
                      background: a.answer ? 'oklch(0.3 0.06 150)' : 'oklch(0.28 0.015 55)',
                      color: a.answer ? 'oklch(0.85 0.1 150)' : 'oklch(0.72 0.014 80)'
                    }}
                  >
                    {a.answer ? 'ДА' : 'НЕТ'}
                  </span>
                  <span style={{ fontSize: 12, lineHeight: 1.4, color: 'oklch(0.82 0.012 80)' }}>
                    {citizen?.job}
                    {a.viaDiner && ' (закусочная)'}: {questionText(a.attribute, a.value)}
                    <span style={{ fontFamily: FONT.mono, fontSize: 10, color: 'oklch(0.5 0.014 80)' }}>
                      {' '}
                      · ход {a.turnNumber}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: '0.24em',
            color: 'oklch(0.8 0.1 250)',
            marginBottom: 8
          }}
        >
          ОТВЕТЫ ПО ЖЕТОНАМ · ВСЕГДА ЧЕСТНЫЕ
        </div>
        {policeAnswers.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'oklch(0.55 0.014 80)' }}>
            Жетонами ещё не пользовались.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...policeAnswers].reverse().map((a, i) => {
              const citizen = citizens.find(c => c.id === a.citizenId);
              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      padding: '3px 6px',
                      borderRadius: 2,
                      flexShrink: 0,
                      background: a.canKill ? 'oklch(0.3 0.06 27)' : 'oklch(0.26 0.04 250 / .7)',
                      color: a.canKill ? 'oklch(0.85 0.1 30)' : 'oklch(0.88 0.05 250)'
                    }}
                  >
                    {a.canKill ? 'МОГ' : 'НЕ МОГ'}
                  </span>
                  <span style={{ fontSize: 12, lineHeight: 1.4, color: 'oklch(0.82 0.012 80)' }}>
                    Убийца {a.canKill ? 'мог' : 'не мог'} убить жителя {citizen?.job}
                    <span style={{ fontFamily: FONT.mono, fontSize: 10, color: 'oklch(0.5 0.014 80)' }}>
                      {' '}
                      · ход {a.turnNumber}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
