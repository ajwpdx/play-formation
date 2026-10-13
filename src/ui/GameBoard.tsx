import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyMove, isDefended, legalMoves, type Card, type GameState, type Move } from '../engine';
import { CardView } from './CardView';
import { SUITS, SuitIcon } from './suits';

const ANIM_MS = 700;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

type Targeting = 'switch' | 'replace' | 'steal' | null;

const HINT: Record<Card['action'], string> = {
  switch: 'Switch: click another card in your Playing Area to swap with.',
  replace: 'Replace: click a River card to take.',
  steal: "Steal: click an undefended opponent card to take.",
  collect: '',
  defend: 'Defend is passive: it protects itself and adjacent same-suit cards. You can only discard it.',
};

interface Snapshot {
  cards: Map<number, { rect: DOMRect; node: HTMLElement }>;
  draw: DOMRect;
}

function Pile({ count, label, pileRef }: { count: number; label: string; pileRef: React.Ref<HTMLDivElement> }) {
  return (
    <div className="pile">
      <div className="stack" ref={pileRef}>
        {count === 0 ? <div className="slot" /> : (
          <>
            {count > 2 && <div className="back" style={{ top: 4, left: 4 }} />}
            {count > 1 && <div className="back" style={{ top: 2, left: 2 }} />}
            <div className="back" />
          </>
        )}
      </div>
      <small>{label} · {count}</small>
    </div>
  );
}

function Tally({ title, cards, numSuits }: { title: string; cards: Card[]; numSuits: number }) {
  const counts = Array.from({ length: numSuits }, (_, s) => cards.filter((c) => c.suit === s).length);
  return (
    <aside className="tally">
      <h4>{title}</h4>
      {counts.map((n, s) => (
        <div key={s} className={n === 0 ? 'row zero' : 'row'} title={SUITS[s].name}>
          <SuitIcon suit={s} size={20} /><span>{n}</span>
        </div>
      ))}
    </aside>
  );
}

export function GameBoard({ initial, showTally, onExit }: { initial: GameState; showTally: boolean; onExit: () => void }) {
  const [state, setState] = useState(initial);
  /** Whose Playing Area is shown at the bottom. Lags behind state.current until animations finish. */
  const [viewer, setViewer] = useState(initial.current);
  const [animating, setAnimating] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [targeting, setTargeting] = useState<Targeting>(null);
  const [log, setLog] = useState<string[]>([]);

  const boardRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const latest = useRef(state);

  const me = viewer;
  const myGrid = state.grids[me];
  const interactive = !animating && state.winner === null;
  const moves = useMemo(() => legalMoves(state), [state]);

  // ---- animation: FLIP every card by id, ghost cards that left to the Trash ----
  const snapshot = (): Snapshot => {
    const cards = new Map<number, { rect: DOMRect; node: HTMLElement }>();
    boardRef.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      cards.set(Number(el.dataset.cardId), { rect: el.getBoundingClientRect(), node: el.cloneNode(true) as HTMLElement });
    });
    return { cards, draw: drawRef.current!.getBoundingClientRect() };
  };

  useLayoutEffect(() => {
    const snap = snapRef.current;
    if (!snap) return;
    snapRef.current = null;
    const trash = trashRef.current!.getBoundingClientRect();
    const seen = new Set<number>();

    boardRef.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      const id = Number(el.dataset.cardId);
      seen.add(id);
      const to = el.getBoundingClientRect();
      const from = snap.cards.get(id)?.rect ?? snap.draw; // unseen cards come off the Draw Pile
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sc = from.width / to.width;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sc - 1) < 0.01) return;
      el.style.zIndex = '60';
      el.style.transformOrigin = 'top left';
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${sc})` }, { transform: 'none' }],
        { duration: ANIM_MS, easing: EASE },
      ).onfinish = () => { el.style.zIndex = ''; };
    });

    snap.cards.forEach(({ rect, node }, id) => {
      if (seen.has(id)) return;
      const ghost = node;
      ghost.removeAttribute('data-card-id');
      ghost.classList.remove('targetable', 'selected');
      Object.assign(ghost.style, {
        position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
        height: `${rect.height}px`, margin: '0', zIndex: '55', pointerEvents: 'none', transformOrigin: 'top left',
      });
      document.body.appendChild(ghost);
      ghost.animate(
        [{ transform: 'none' }, { transform: `translate(${trash.left - rect.left}px, ${trash.top - rect.top}px) scale(${trash.width / rect.width})` }],
        { duration: ANIM_MS, easing: EASE, fill: 'forwards' },
      ).onfinish = () => ghost.remove();
    });
  }, [state]);

  const commit = (move: Move, text: string | null) => {
    const next = applyMove(state, move);
    snapRef.current = snapshot();
    latest.current = next;
    setState(next);
    setSelected(null);
    setTargeting(null);
    setAnimating(true);
    if (text) setLog((l) => [`P${me + 1}: ${text}`, ...l].slice(0, 5));
    // Show the action first, then hand the board to the next player.
    window.setTimeout(() => {
      setViewer(latest.current.current);
      setAnimating(false);
    }, ANIM_MS + 100);
  };

  // ---- interactions ----
  const clickOwn = (cell: number) => {
    if (selected === cell) { setSelected(null); setTargeting(null); return; }
    if (targeting === 'switch' && selected !== null) {
      return commit({ type: 'switch', cell: selected, target: cell }, `switched cells ${selected + 1} and ${cell + 1}`);
    }
    const card = myGrid[cell]!;
    setSelected(cell);
    setTargeting(null);
    // Selecting an action card starts its action immediately.
    if (card.action === 'collect') return commit({ type: 'collect', cell }, 'used Collect');
    if (card.action === 'switch') setTargeting('switch');
    if (card.action === 'replace') setTargeting('replace');
    if (card.action === 'steal' && moves.some((m) => m.type === 'steal' && m.cell === cell)) setTargeting('steal');
  };

  const selectedCard = selected !== null ? myGrid[selected] : null;
  const noSteal = selectedCard?.action === 'steal' && targeting !== 'steal';

  const prompt = state.winner !== null || animating ? ''
    : state.pending ? 'Collect: keep one of the two drawn cards.'
    : selectedCard ? (noSteal ? 'No undefended opponent cards to steal. You can discard instead.' : HINT[selectedCard.action])
    : 'Select one of your cards.';

  const turnLabel = `Player ${(animating ? me : state.current) + 1}'s turn`;

  return (
    <div className="board" ref={boardRef}>
      <header>
        <button className="link" onClick={onExit}>New game</button>
        <span>Turn {state.turn} · {state.drawPile.length} in Draw · {state.trash.length} in Trash</span>
      </header>

      <div className={showTally ? 'layout with-tally' : 'layout'}>
        {showTally && <Tally title="Draw" cards={state.drawPile} numSuits={state.config.numSuits} />}

        <main>
          <div className="opponents" key={`opp-${viewer}`}>
            {state.grids.map((grid, p) => p === me ? null : (
              <div key={p} className="player">
                <h3>Player {p + 1}</h3>
                <div className="grid small">
                  {grid.map((card, i) => {
                    const defended = isDefended(grid, i);
                    const can = interactive && targeting === 'steal' && !defended;
                    return (
                      <CardView key={i} card={card} small defended={defended} targetable={can}
                        onClick={can ? () => commit(
                          { type: 'steal', cell: selected!, targetPlayer: p, targetCell: i }, `stole from P${p + 1}`,
                        ) : undefined} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="river-wrap">
            <Pile count={state.drawPile.length} label="Draw" pileRef={drawRef} />
            <button className="discard-slot" disabled={!interactive || selected === null}
              onClick={() => commit({ type: 'discard', cell: selected! }, `discarded cell ${selected! + 1}`)}>
              Discard
            </button>
            <div className="river">
              {state.river.map((card, i) => {
                const can = interactive && targeting === 'replace';
                return (
                  <CardView key={card.id} card={card} targetable={can}
                    onClick={can ? () => commit(
                      { type: 'replace', cell: selected!, riverIndex: i }, 'replaced a card from the River',
                    ) : undefined} />
                );
              })}
            </div>
            <Pile count={state.trash.length} label="Trash" pileRef={trashRef} />
            <div className="flow">River flows toward the Trash →</div>
          </div>

          <div className="mine" key={`mine-${viewer}`}>
            <h2>{turnLabel}</h2>
            <p className="prompt">{prompt}</p>
            <div className="grid">
              {myGrid.map((card, i) => (
                <CardView key={i} card={card} defended={isDefended(myGrid, i)} selected={selected === i}
                  targetable={interactive && targeting === 'switch' && i !== selected}
                  onClick={interactive && !state.pending ? () => clickOwn(i) : undefined} />
              ))}
            </div>
          </div>

          {log.length > 0 && <ul className="log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </main>

        {showTally && <Tally title="Trash" cards={state.trash} numSuits={state.config.numSuits} />}
      </div>

      {state.pending && (
        <div className="overlay" style={{ pointerEvents: animating ? 'none' : 'auto' }}>
          <div className="modal">
            <h2>Collect: keep one</h2>
            <div className="choose">
              {state.pending.drawn.map((card, i) => (
                <CardView key={card.id} card={card}
                  onClick={interactive ? () => commit({ type: 'collectChoose', keep: i as 0 | 1 }, null) : undefined} />
              ))}
            </div>
            <p>Click the card to keep. The other goes to the start of the River.</p>
          </div>
        </div>
      )}

      {state.winner !== null && !animating && (
        <div className="overlay">
          <div className="modal">
            <h1>🎉 Player {state.winner + 1} wins!</h1>
            <button className="primary" onClick={onExit}>Play again</button>
          </div>
        </div>
      )}
    </div>
  );
}
