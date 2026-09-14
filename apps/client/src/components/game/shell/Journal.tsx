import type {
  AnsweredQuestion,
  Citizen,
  CitizenPosition,
  PoliceTokenAnswer
} from '@citykiller/shared';
import { FONT, P } from '@/design/tokens';
import { GROUP_CHIT, groupRing, monogram } from '@/design/city';
import { ATTRIBUTE_LABELS, valueLabel } from '@/lib/labels';

interface JournalProps {
  citizens: Citizen[];
  positions: CitizenPosition[];
  answers: AnsweredQuestion[];
  policeAnswers: PoliceTokenAnswer[];
  /** Ответы, которым детектив не верит: таблица дедукции их не учитывает */
  ignoredIds?: string[];
  /** Учтённые ответы, противоречащие друг другу */
  conflictIds?: Set<string>;
  onToggleAnswer?: (answerId: string) => void;
}

interface Row {
  key: string;
  /** id ответа жителя; у ответов по жетону нет — им верят всегда */
  answerId?: string;
  turn: number;
  citizen: Citizen | undefined;
  source: 'question' | 'diner' | 'token';
  question: string;
  answer: string;
  /** Честный ответ по жетону нельзя подделать */
  honest: boolean;
  positive: boolean;
}

/**
 * Журнал допросов: кого спрашивали, из какой группы, о чём и что ответили.
 * Ответы жителей могут быть ложью, ответы по жетонам — нет, поэтому они помечены.
 */
export function Journal({
  citizens,
  positions,
  answers,
  policeAnswers,
  ignoredIds = [],
  conflictIds,
  onToggleAnswer
}: JournalProps) {
  const byId = (id: number) => citizens.find(c => c.id === id);

  const rows: Row[] = [
    ...answers.map(a => ({
      key: `q-${a.id}`,
      answerId: a.id,
      turn: a.turnNumber,
      citizen: byId(a.citizenId),
      source: a.viaDiner ? ('diner' as const) : ('question' as const),
      question: `${ATTRIBUTE_LABELS[a.attribute]}: ${valueLabel(a.attribute, a.value)}?`,
      answer: a.answer ? 'ДА' : 'НЕТ',
      honest: false,
      positive: a.answer
    })),
    ...policeAnswers.map((a, i) => ({
      key: `t-${i}-${a.citizenId}`,
      turn: a.turnNumber,
      citizen: byId(a.citizenId),
      source: 'token' as const,
      question: 'Можешь убить его сейчас?',
      answer: a.canKill ? 'МОГ' : 'НЕ МОГ',
      honest: true,
      positive: a.canKill
    }))
  ].sort((a, b) => b.turn - a.turn || b.key.localeCompare(a.key));

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12.5, color: 'oklch(0.58 0.014 80)' }}>
        Журнал пуст: допросов ещё не было.
      </p>
    );
  }

  const head = (label: string, width?: number) => (
    <th
      key={label}
      style={{
        textAlign: 'left',
        padding: '0 8px 7px 0',
        width,
        fontFamily: FONT.mono,
        fontSize: 9,
        letterSpacing: '0.16em',
        fontWeight: 400,
        color: 'oklch(0.58 0.014 80)',
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </th>
  );

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid oklch(0.3 0.015 55)' }}>
          {head('ХОД', 34)}
          {head('КОГО СПРАШИВАЛИ')}
          {head('ВОПРОС')}
          {head('ОТВЕТ', 76)}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const dead = r.citizen
            ? positions.find(p => p.citizenId === r.citizen!.id)?.isDead
            : false;
          const ignored = !!r.answerId && ignoredIds.includes(r.answerId);
          const conflict = !!r.answerId && !!conflictIds?.has(r.answerId);
          return (
            <tr
              key={r.key}
              style={{
                borderBottom: '1px solid oklch(0.26 0.014 55)',
                opacity: ignored ? 0.5 : 1,
                boxShadow: conflict ? `inset 3px 0 0 ${P.blood}` : 'none'
              }}
            >
              <td
                style={{
                  padding: conflict ? '7px 8px 7px 7px' : '7px 8px 7px 0',
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  color: 'oklch(0.55 0.014 80)',
                  verticalAlign: 'top'
                }}
              >
                {String(r.turn).padStart(2, '0')}
              </td>
              <td style={{ padding: '7px 8px 7px 0', verticalAlign: 'top' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {r.citizen && (
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        flexShrink: 0,
                        borderRadius: 9999,
                        background: P.paper,
                        border: `2px solid ${groupRing(r.citizen.group)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: FONT.display,
                        fontSize: 11,
                        fontWeight: 800,
                        color: P.paperInk,
                        opacity: dead ? 0.45 : 1
                      }}
                    >
                      {monogram(r.citizen.job)}
                    </span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: P.ink,
                        textDecoration: dead ? 'line-through' : 'none'
                      }}
                    >
                      {r.citizen?.job ?? '—'}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: FONT.mono,
                        fontSize: 9.5,
                        color: 'oklch(0.58 0.014 80)'
                      }}
                    >
                      {r.citizen ? GROUP_CHIT[r.citizen.group] : ''}
                      {r.source === 'diner' && ' · ЗАКУСОЧНАЯ'}
                      {r.source === 'token' && ' · ЖЕТОН'}
                    </span>
                  </span>
                </div>
              </td>
              <td
                style={{
                  padding: '7px 8px 7px 0',
                  fontSize: 12,
                  lineHeight: 1.35,
                  color: 'oklch(0.82 0.012 80)',
                  verticalAlign: 'top',
                  textDecoration: ignored ? 'line-through' : 'none'
                }}
              >
                {r.question}
                {conflict && (
                  <span
                    style={{
                      display: 'block',
                      fontFamily: FONT.mono,
                      fontSize: 8.5,
                      letterSpacing: '0.1em',
                      color: 'oklch(0.78 0.12 30)',
                      marginTop: 3
                    }}
                  >
                    ПРОТИВОРЕЧИТ ДРУГОМУ ОТВЕТУ
                  </span>
                )}
              </td>
              <td style={{ padding: '7px 0', verticalAlign: 'top' }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: '0.1em',
                    padding: '3px 7px',
                    borderRadius: 2,
                    whiteSpace: 'nowrap',
                    background: r.honest
                      ? 'oklch(0.26 0.04 250 / .8)'
                      : r.positive
                        ? 'oklch(0.3 0.06 150)'
                        : 'oklch(0.28 0.015 55)',
                    color: r.honest
                      ? 'oklch(0.88 0.05 250)'
                      : r.positive
                        ? 'oklch(0.85 0.1 150)'
                        : 'oklch(0.76 0.014 80)'
                  }}
                >
                  {r.answer}
                </span>
                {r.honest && (
                  <span
                    style={{
                      display: 'block',
                      fontFamily: FONT.mono,
                      fontSize: 8.5,
                      letterSpacing: '0.1em',
                      color: 'oklch(0.6 0.05 250)',
                      marginTop: 3
                    }}
                  >
                    ЧЕСТНО
                  </span>
                )}
                {/* верить ли ответу — решает детектив; отключённый не участвует в дедукции */}
                {r.answerId && onToggleAnswer && (
                  <button
                    onClick={() => onToggleAnswer(r.answerId!)}
                    title={ignored ? 'Снова учитывать этот ответ' : 'Не учитывать этот ответ в таблице'}
                    style={{
                      display: 'block',
                      marginTop: 4,
                      padding: '2px 5px',
                      borderRadius: 2,
                      border: `1px solid ${ignored ? 'oklch(0.45 0.1 27)' : 'oklch(0.34 0.015 55)'}`,
                      background: ignored ? 'oklch(0.28 0.05 27)' : 'transparent',
                      color: ignored ? 'oklch(0.84 0.09 30)' : 'oklch(0.62 0.014 80)',
                      fontFamily: FONT.mono,
                      fontSize: 8.5,
                      letterSpacing: '0.1em',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer'
                    }}
                  >
                    {ignored ? 'НЕ ВЕРЮ' : 'ВЕРЮ'}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
