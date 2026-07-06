import { useState } from 'react';
import type { Citizen, QuestionAttribute, QuestionValue } from '@citykiller/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ATTRIBUTE_LABELS, ATTRIBUTE_VALUES, questionText } from '@/lib/labels';
import { cn } from '@/lib/utils';

interface QuestionDialogProps {
  citizen: Citizen | null;
  viaDiner: boolean;
  onSubmit: (attribute: QuestionAttribute, value: QuestionValue) => void;
  onClose: () => void;
}

export function QuestionDialog({ citizen, viaDiner, onSubmit, onClose }: QuestionDialogProps) {
  const [attribute, setAttribute] = useState<QuestionAttribute>('sex');
  const [value, setValue] = useState<QuestionValue>('male');

  const attributes = Object.keys(ATTRIBUTE_LABELS) as QuestionAttribute[];

  return (
    <Dialog open={citizen !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="noir-panel">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider">
            Вопрос жителю: {citizen?.job}
            {viaDiner && ' (через закусочную)'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">О чём спросить:</p>
            <div className="flex flex-wrap gap-2">
              {attributes.map(attr => (
                <Button
                  key={attr}
                  variant={attribute === attr ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setAttribute(attr);
                    setValue(ATTRIBUTE_VALUES[attr][0].value);
                  }}
                >
                  {ATTRIBUTE_LABELS[attr]}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Значение:</p>
            <div className="flex flex-wrap gap-2">
              {ATTRIBUTE_VALUES[attribute].map(option => (
                <Button
                  key={String(option.value)}
                  variant={value === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setValue(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className={cn('rounded-md border border-primary/40 bg-primary/5 p-3 text-center font-medium text-lg')}>
            «{questionText(attribute, value)}»
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={() => onSubmit(attribute, value)}>Спросить</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
