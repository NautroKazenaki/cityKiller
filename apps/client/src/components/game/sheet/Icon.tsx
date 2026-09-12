import { ICON, type IconName } from '@/design/tokens';

interface IconProps {
  name?: IconName;
  path?: string;
  size?: number;
  color: string;
  width?: number;
  style?: React.CSSProperties;
}

/** Собственный SVG-набор: сетка 24, штрих 2, квадратные концы. Эмодзи в интерфейсе запрещены. */
export function Icon({ name, path, size = 18, color, width = 1.9, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: size, height: size, display: 'block', flexShrink: 0, ...style }}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="square"
    >
      <path d={path ?? (name ? ICON[name] : '')} />
    </svg>
  );
}
