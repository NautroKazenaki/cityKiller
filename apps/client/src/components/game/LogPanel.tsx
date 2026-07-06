import { useEffect, useRef } from 'react';
import type { GameLogEntry } from '@citykiller/shared';

export function LogPanel({ log }: { log: GameLogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div className="h-full overflow-y-auto space-y-1 text-sm pr-2">
      {log.map(entry => (
        <div key={entry.seq} className="flex gap-2">
          <span className="text-muted-foreground shrink-0">#{entry.turnNumber}</span>
          <span>{entry.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
