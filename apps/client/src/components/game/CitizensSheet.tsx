import type { ReactNode } from 'react';
import type {
  AnsweredQuestion,
  Citizen,
  CitizenPosition,
  PoliceTokenAnswer,
  QuestionAttribute
} from '@citykiller/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GROUP_LABELS, questionText, valueLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

interface CitizensSheetProps {
  citizens: Citizen[];
  positions: CitizenPosition[];
  answers: AnsweredQuestion[];
  policeAnswers: PoliceTokenAnswer[];
}

type CellStatus = 'good' | 'bad' | undefined;

/** Значение характеристики жителя для сопоставления с вопросом */
function citizenValue(citizen: Citizen, attribute: QuestionAttribute) {
  return citizen[attribute];
}

/**
 * Статус ячейки характеристики относительно собранных ответов:
 * - good — характеристика совпадает с подтверждённым признаком убийцы (ответ «ДА»)
 * - bad — противоречит ответу (этот житель не может быть убийцей)
 */
function cellStatusFor(
  citizen: Citizen,
  attribute: QuestionAttribute,
  answers: AnsweredQuestion[]
): CellStatus {
  let status: CellStatus;
  for (const a of answers) {
    if (a.attribute !== attribute) continue;
    const matches = citizenValue(citizen, attribute) === a.value;
    // «ДА» ⇒ у убийцы этот признак; «НЕТ» ⇒ у убийцы его нет
    const consistent = a.answer === matches;
    if (!consistent) return 'bad';
    if (a.answer && matches) status = 'good';
  }
  return status;
}

const cellClass: Record<'good' | 'bad', string> = {
  good: 'bg-emerald-500/25 text-emerald-200 font-semibold rounded',
  bad: 'bg-rose-500/20 text-rose-300/80 rounded'
};

/** Допросный лист детектива: таблица жителей + собранные ответы, с автоматической подсветкой */
export function CitizensSheet({ citizens, positions, answers, policeAnswers }: CitizensSheetProps) {
  const askedAttributes = new Set(answers.map(a => a.attribute));

  // Житель исключён, если хотя бы одна ячейка противоречит ответам
  const isExcluded = (citizen: Citizen) =>
    (['sex', 'age', 'size', 'height'] as QuestionAttribute[]).some(
      attr => cellStatusFor(citizen, attr, answers) === 'bad'
    );

  const suspects = citizens.filter(c => {
    const pos = positions.find(p => p.citizenId === c.id);
    return pos && !pos.isDead && !isExcluded(c);
  }).length;

  const renderCell = (citizen: Citizen, attribute: QuestionAttribute, content: ReactNode) => {
    const status = askedAttributes.has(attribute) ? cellStatusFor(citizen, attribute, answers) : undefined;
    return (
      <td className="py-1 pr-2">
        <span className={cn('px-1.5 py-0.5', status && cellClass[status])}>{content}</span>
      </td>
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          📋 Допросный лист
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto noir-panel">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest text-xl text-gold">
            📋 Допросный лист
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Жители ({citizens.length})</h3>
              <Badge variant="secondary">Под подозрением: {suspects}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 mb-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-emerald-500/40" /> совпадает с ответом
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-rose-500/40" /> противоречит
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/60">
                  <th className="py-1 pr-2">Профессия</th>
                  <th className="py-1 pr-2">Группа</th>
                  <th className={cn('py-1 pr-2', askedAttributes.has('sex') && 'text-gold')}>Пол</th>
                  <th className={cn('py-1 pr-2', askedAttributes.has('age') && 'text-gold')}>Возраст</th>
                  <th className={cn('py-1 pr-2', askedAttributes.has('size') && 'text-gold')}>Тело</th>
                  <th className={cn('py-1 pr-2', askedAttributes.has('height') && 'text-gold')}>Рост</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {citizens.map(citizen => {
                  const pos = positions.find(p => p.citizenId === citizen.id);
                  const excluded = !pos?.isDead && isExcluded(citizen);
                  return (
                    <tr
                      key={citizen.id}
                      className={cn(
                        'border-b border-border/40',
                        pos?.isDead && 'opacity-40 line-through',
                        excluded && 'opacity-55'
                      )}
                    >
                      <td className="py-1 pr-2 font-medium">
                        {excluded && <span className="text-rose-400/80 mr-1">✗</span>}
                        {citizen.job}
                      </td>
                      <td className="py-1 pr-2">{GROUP_LABELS[citizen.group]}</td>
                      {renderCell(citizen, 'sex', citizen.sex === 'male' ? 'М' : 'Ж')}
                      {renderCell(citizen, 'age', citizen.age)}
                      {renderCell(citizen, 'size', citizen.size)}
                      {renderCell(citizen, 'height', valueLabel('height', citizen.height))}
                      <td className="py-1">
                        {pos?.isDead ? '💀' : pos?.isScared ? '😰' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Ответы на вопросы</h3>
              {answers.length === 0 && (
                <p className="text-muted-foreground text-sm">Вопросов ещё не задавали</p>
              )}
              <div className="space-y-2">
                {answers.map(a => {
                  const citizen = citizens.find(c => c.id === a.citizenId);
                  return (
                    <div key={a.id} className="text-sm flex items-start gap-2">
                      <Badge variant={a.answer ? 'default' : 'secondary'}>
                        {a.answer ? 'ДА' : 'НЕТ'}
                      </Badge>
                      <span>
                        <span className="font-medium">{citizen?.job}</span>
                        {a.viaDiner && ' (через закусочную)'}: {questionText(a.attribute, a.value)}
                        <span className="text-muted-foreground"> — ход {a.turnNumber}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Ответы по жетонам (всегда честно)</h3>
              {policeAnswers.length === 0 && (
                <p className="text-muted-foreground text-sm">Жетонами ещё не пользовались</p>
              )}
              <div className="space-y-2">
                {policeAnswers.map((a, i) => {
                  const citizen = citizens.find(c => c.id === a.citizenId);
                  return (
                    <div key={i} className="text-sm flex items-start gap-2">
                      <Badge variant={a.canKill ? 'destructive' : 'secondary'}>
                        {a.canKill ? 'МОЖЕТ' : 'НЕ МОЖЕТ'}
                      </Badge>
                      <span>
                        Убийца {a.canKill ? 'мог' : 'не мог'} убить жителя{' '}
                        <span className="font-medium">{citizen?.job}</span>
                        <span className="text-muted-foreground"> — ход {a.turnNumber}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
