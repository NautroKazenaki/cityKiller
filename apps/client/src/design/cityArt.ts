/**
 * Процедурный арт города для игрового листа.
 * Перенос из макета «Дело на столе» без изменений: рекурсивное деление на кварталы
 * с убывающей шириной улиц + застройка внутри кварталов.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CityArt {
  blocks: Rect[];
  buildings: Rect[];
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function generateCityIn(W: number, H: number, seed: number, gutScale: number): CityArt {
  const k = gutScale / 17;
  const r = makeRng(seed);
  const blocks: Rect[] = [];
  const area = (W * H) / 500;

  function split(x: number, y: number, w: number, h: number, depth: number): void {
    const gut = (depth === 0 ? 17 : depth === 1 ? 13 : depth === 2 ? 10 : depth === 3 ? 7.5 : 5.5) * k;
    const minSide = 30 * k * 1.6;
    if (depth > 7 || w * h < area) {
      blocks.push({ x, y, w, h });
      return;
    }
    const horiz = w >= h;
    const t = 0.36 + r() * 0.28;
    if (horiz) {
      const cut = w * t;
      if (cut < minSide || w - cut - gut < minSide) {
        blocks.push({ x, y, w, h });
        return;
      }
      split(x, y, cut, h, depth + 1);
      split(x + cut + gut, y, w - cut - gut, h, depth + 1);
    } else {
      const cut = h * t;
      if (cut < minSide || h - cut - gut < minSide) {
        blocks.push({ x, y, w, h });
        return;
      }
      split(x, y, w, cut, depth + 1);
      split(x, y + cut + gut, w, h - cut - gut, depth + 1);
    }
  }
  split(0, 0, W, H, 0);

  const buildings: Rect[] = [];
  for (const b of blocks) {
    if (b.w < 26 * k || b.h < 26 * k) continue;
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const bw = Math.max(7 * k, b.w * (0.18 + r() * 0.34));
      const bh = Math.max(7 * k, b.h * (0.18 + r() * 0.34));
      buildings.push({
        x: +(b.x + 4 * k + r() * Math.max(0, b.w - bw - 8 * k)).toFixed(1),
        y: +(b.y + 4 * k + r() * Math.max(0, b.h - bh - 8 * k)).toFixed(1),
        w: +bw.toFixed(1),
        h: +bh.toFixed(1)
      });
    }
  }

  return {
    blocks: blocks.map(b => ({
      x: +b.x.toFixed(1),
      y: +b.y.toFixed(1),
      w: +b.w.toFixed(1),
      h: +b.h.toFixed(1)
    })),
    buildings
  };
}

/** Стабильный seed из id партии — город одинаков у обоих игроков и между перезаходами */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
