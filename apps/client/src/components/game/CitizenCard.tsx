import type { Citizen } from '@citykiller/shared';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GROUP_LABELS, valueLabel } from '@/lib/labels';

interface CitizenCardProps {
  citizen: Citizen;
  isScared?: boolean;
  isDead?: boolean;
  isKiller?: boolean;
  onClick?: () => void;
}

export function CitizenCard({ citizen, isScared, isDead, isKiller, onClick }: CitizenCardProps) {
  return (
    <Card
      className={cn(
        'p-3 flex flex-col gap-2',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        isScared && 'border-red-400/70 bg-red-950/40',
        isDead && 'opacity-50 grayscale',
        isKiller && 'border-2 border-purple-400/80 bg-purple-950/30'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">{citizen.job}</span>
        <span className="text-xl">
          {isDead ? '💀' : isScared ? '😰' : citizen.sex === 'male' ? '👨' : '👩'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">{citizen.sex === 'male' ? 'М' : 'Ж'}</Badge>
        <Badge variant="outline">{citizen.age} лет</Badge>
        <Badge variant="secondary">{citizen.size}</Badge>
        <Badge variant="secondary">{valueLabel('height', citizen.height)}</Badge>
        <Badge>{GROUP_LABELS[citizen.group]}</Badge>
      </div>
      {isKiller && (
        <div className="text-xs text-purple-300 font-semibold">Это вы — убийца</div>
      )}
    </Card>
  );
}
