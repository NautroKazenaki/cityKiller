import { useState } from 'react';
import type { Citizen } from '@citykiller/shared';
import { MOTIVE_DESCRIPTORS } from '@citykiller/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccuseDialogProps {
  open: boolean;
  forced: boolean;
  citizens: Citizen[];
  /** id 6 мотивов-кандидатов, среди которых один настоящий */
  motiveOptions: string[];
  onSubmit: (job: string, motiveId: string) => void;
  onClose: () => void;
}

export function AccuseDialog({ open, forced, citizens, motiveOptions, onSubmit, onClose }: AccuseDialogProps) {
  const [job, setJob] = useState<string | null>(null);
  const [motiveId, setMotiveId] = useState<string | null>(null);

  const motives = MOTIVE_DESCRIPTORS.filter(m => motiveOptions.includes(m.id));

  return (
    <Dialog open={open} onOpenChange={o => !o && !forced && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto noir-panel">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest text-2xl text-gold">
            ⚖️ Обвинение
          </DialogTitle>
          <DialogDescription>
            {forced
              ? 'Совершено пятое убийство! Вы обязаны назвать профессию убийцы и его мотив. Ошибка в любом из пунктов — поражение.'
              : 'Назовите профессию убийцы и его мотив. Ошибка в любом из пунктов — поражение.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="font-semibold mb-2">Кто убийца?</p>
            <div className="grid grid-cols-4 gap-1">
              {citizens.map(citizen => (
                <Button
                  key={citizen.id}
                  variant={job === citizen.job ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start"
                  onClick={() => setJob(citizen.job)}
                >
                  {citizen.job}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold mb-2">
              Каков мотив? <span className="text-muted-foreground font-normal">(один из {motives.length} — настоящий)</span>
            </p>
            <div className="grid grid-cols-2 gap-1">
              {motives.map(motive => (
                <Button
                  key={motive.id}
                  variant={motiveId === motive.id ? 'default' : 'outline'}
                  size="sm"
                  className={cn('justify-start h-auto py-2 text-left whitespace-normal')}
                  onClick={() => setMotiveId(motive.id)}
                >
                  <span>
                    <span className="font-semibold">{motive.title}.</span> {motive.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {!forced && (
              <Button variant="outline" onClick={onClose}>
                Отмена
              </Button>
            )}
            <Button
              variant="destructive"
              disabled={!job || !motiveId}
              onClick={() => job && motiveId && onSubmit(job, motiveId)}
            >
              Предъявить обвинение
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
