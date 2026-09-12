import { LAYOUT } from '@/design/tokens';

const CELL = LAYOUT.city / 4;

/**
 * Фишка детектива живёт над сеткой районов, а не внутри клетки:
 * так она едет по прямой между центрами районов (420 мс), а световое пятно тянется за ней.
 */
export function DetectiveCar({
  district,
  /** В районе уже лежит карточка места преступления — фишка встаёт ниже, чтобы не перекрывать */
  withCrime
}: {
  district: { x: number; y: number } | null;
  withCrime: boolean;
}) {
  if (!district) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: CELL,
        height: CELL,
        transform: `translate(${district.x * CELL}px, ${district.y * CELL}px)`,
        transition: 'transform .42s ease-in-out',
        pointerEvents: 'none',
        zIndex: 6
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, ${withCrime ? '4%' : '-50%'})`,
          transition: 'transform .42s ease-in-out'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 150,
            height: 150,
            transform: 'translate(-50%,-50%)',
            borderRadius: 9999,
            background: 'radial-gradient(circle, oklch(0.62 0.12 250 / .22), transparent 68%)'
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 50,
            height: 50,
            borderRadius: 5,
            background: 'linear-gradient(165deg, oklch(0.36 0.1 252), oklch(0.24 0.07 252))',
            border: '2.5px solid oklch(0.72 0.1 250)',
            boxShadow: '0 3px 0 oklch(0.18 0.04 252), 0 10px 18px -6px rgba(0,0,0,.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg
            viewBox="0 0 24 24"
            style={{ width: 26, height: 26 }}
            fill="none"
            stroke="oklch(0.93 0.03 250)"
            strokeWidth={1.9}
            strokeLinecap="square"
          >
            <path d="M3 14h18M5 14l2-6h10l2 6M5 14v4h3v-4M16 14v4h3v-4" />
            <path d="M9 8V5h6v3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
