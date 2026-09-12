import { useLayoutEffect, useRef } from 'react';
import type { CitizenPosition } from '@citykiller/shared';

/** Длительность переезда жетона и задержка между жителями — из макета */
const MOVE_MS = 360;
const STAGGER_MS = 80;

/**
 * Жетоны переезжают между районами, а не телепортируются.
 * Техника FLIP: запоминаем позиции до перерисовки, после — сдвигаем жетон обратно
 * трансформом и отпускаем в ноль. Порядок переездов читается за счёт задержки.
 */
export function useChitFlip(positions: CitizenPosition[]) {
  const nodes = useRef(new Map<number, HTMLElement>());
  const prevRects = useRef(new Map<number, DOMRect>());

  const register = (citizenId: number, el: HTMLElement | null) => {
    if (el) nodes.current.set(citizenId, el);
    else nodes.current.delete(citizenId);
  };

  useLayoutEffect(() => {
    let order = 0;
    for (const [id, el] of nodes.current) {
      const prev = prevRects.current.get(id);
      const next = el.getBoundingClientRect();
      if (prev) {
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          const delay = order++ * STAGGER_MS;
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: MOVE_MS, delay, easing: 'ease-in-out', fill: 'backwards' }
          );
        }
      }
    }
    // снимок для следующего обновления
    const snapshot = new Map<number, DOMRect>();
    for (const [id, el] of nodes.current) {
      snapshot.set(id, el.getBoundingClientRect());
    }
    prevRects.current = snapshot;
  }, [positions]);

  return register;
}
