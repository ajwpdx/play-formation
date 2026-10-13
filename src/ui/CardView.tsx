import type { Card } from '../engine';
import { SUITS, SuitIcon } from './suits';

const LABEL: Record<Card['action'], string> = {
  switch: 'SWITCH',
  defend: 'DEFEND',
  replace: 'REPLACE',
  collect: 'COLLECT',
  steal: 'STEAL',
};

interface Props {
  card: Card | null;
  small?: boolean;
  defended?: boolean;
  selected?: boolean;
  targetable?: boolean;
  onClick?: () => void;
}

export function CardView({ card, small, defended, selected, targetable, onClick }: Props) {
  const cls = ['card', small && 'small', selected && 'selected', targetable && 'targetable', !card && 'empty']
    .filter(Boolean)
    .join(' ');
  if (!card) return <div className={cls} />;
  const color = SUITS[card.suit].color;
  return (
    <button
      type="button"
      data-card-id={card.id}
      className={cls}
      style={{ borderColor: color }}
      onClick={onClick}
      disabled={!onClick}
      title={`${SUITS[card.suit].name} - ${LABEL[card.action]}${defended ? ' (defended)' : ''}`}
    >
      <span className="label top" style={{ color }}>{LABEL[card.action]}</span>
      <SuitIcon suit={card.suit} size={small ? 26 : 46} />
      <span className="label bottom" style={{ color }}>{LABEL[card.action]}</span>
      {defended && <span className="lock" aria-label="defended">🔒</span>}
    </button>
  );
}
