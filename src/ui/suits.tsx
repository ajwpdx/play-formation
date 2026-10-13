/** Visual identity for the 15 suits: each has a distinct shape AND colour. */

type Shape =
  | { kind: 'circle' }
  | { kind: 'rect' }
  | { kind: 'poly'; points: string }
  | { kind: 'path'; d: string };

export interface SuitStyle {
  name: string;
  color: string;
  shape: Shape;
}

/** Regular polygon points inside a 100x100 box. */
function regular(n: number, rotate = -90): string {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rotate + (360 / n) * i) * Math.PI) / 180;
    return `${(50 + 46 * Math.cos(a)).toFixed(1)},${(50 + 46 * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function star(): string {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 48 : 21;
    const a = ((-90 + 36 * i) * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

export const SUITS: SuitStyle[] = [
  { name: 'Red Circle', color: '#e8553a', shape: { kind: 'circle' } },
  { name: 'Green Square', color: '#5cb846', shape: { kind: 'rect' } },
  { name: 'Yellow Triangle', color: '#f6bb1f', shape: { kind: 'poly', points: '4,12 96,12 50,92' } },
  { name: 'Pink Diamond', color: '#f08fb0', shape: { kind: 'poly', points: '50,4 96,50 50,96 4,50' } },
  { name: 'Orange Hexagon', color: '#f2792b', shape: { kind: 'poly', points: regular(6, 0) } },
  { name: 'Teal Pentagon', color: '#1fae9a', shape: { kind: 'poly', points: regular(5) } },
  {
    name: 'Maroon Cross',
    color: '#7a2438',
    shape: { kind: 'poly', points: '35,6 65,6 65,35 94,35 94,65 65,65 65,94 35,94 35,65 6,65 6,35 35,35' },
  },
  { name: 'Navy Chevron', color: '#1d3a8a', shape: { kind: 'poly', points: '6,72 50,10 94,72 94,94 50,36 6,94' } },
  { name: 'Forest Octagon', color: '#1c6b3a', shape: { kind: 'poly', points: regular(8, -67.5) } },
  { name: 'Lavender Star', color: '#a78bdc', shape: { kind: 'poly', points: star() } },
  {
    name: 'Purple Heart',
    color: '#8a2ba0',
    shape: { kind: 'path', d: 'M50 92 C8 62 4 34 24 18 C38 8 50 20 50 30 C50 20 62 8 76 18 C96 34 92 62 50 92 Z' },
  },
  { name: 'Gold Moon', color: '#b8860b', shape: { kind: 'path', d: 'M62 6 A44 44 0 1 0 94 66 A36 36 0 1 1 62 6 Z' } },
  { name: 'Sky Bolt', color: '#27b0f0', shape: { kind: 'poly', points: '60,2 20,56 46,56 36,98 80,40 54,40' } },
  {
    name: 'Black Drop',
    color: '#25252b',
    shape: { kind: 'path', d: 'M50 4 C50 4 18 44 18 64 A32 32 0 0 0 82 64 C82 44 50 4 50 4 Z' },
  },
  {
    name: 'Slate X',
    color: '#6b7f8f',
    shape: { kind: 'poly', points: '18,4 50,36 82,4 96,18 64,50 96,82 82,96 50,64 18,96 4,82 36,50 4,18' },
  },
];

export function SuitIcon({ suit, size = 40 }: { suit: number; size?: number }) {
  const { color, shape, name } = SUITS[suit];
  const common = { fill: color, stroke: 'rgba(0,0,0,0.25)', strokeWidth: 2 };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={name}>
      {shape.kind === 'circle' && <circle cx="50" cy="50" r="46" {...common} />}
      {shape.kind === 'rect' && <rect x="6" y="6" width="88" height="88" rx="6" {...common} />}
      {shape.kind === 'poly' && <polygon points={shape.points} strokeLinejoin="round" {...common} />}
      {shape.kind === 'path' && <path d={shape.d} {...common} />}
    </svg>
  );
}
